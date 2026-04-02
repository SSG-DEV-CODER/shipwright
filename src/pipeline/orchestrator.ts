/**
 * Pipeline Orchestrator — the main adversarial build loop
 *
 * For each sprint: Scout → Plan (file) → Negotiate → Build → Evaluate → Retry → Improve → Commit
 *
 * Key design decisions (docs/decisions/001-generator-pattern.md):
 * - Plan written to file, generator reads it (not passed in prompt)
 * - Feedback written to file, generator reads it on retry
 * - Git diff after build detects what was created (not generator self-report)
 * - maxTurns unlimited for generator and evaluator
 */

import { resolve } from "path";
import { execSync } from "child_process";
import { parsePRD } from "../intake/prd-parser.js";
import { deriveSprints } from "../intake/sprint-planner.js";
import { loadExpertise, formatExpertiseForPrompt } from "../expertise/loader.js";
import { setVerbose } from "../agents/base.js";
import { runScouts, formatScoutReports } from "../agents/scout.js";
import { runPlanner } from "../agents/planner.js";
import { runGenerator } from "../agents/generator.js";
import { runEvaluator } from "../agents/evaluator.js";
import { runImprover } from "../agents/improver.js";
import { runValidator, formatValidationReport } from "../agents/validator.js";
import { applyExpertiseUpdate } from "../expertise/updater.js";
import { writeProgress } from "../tracking/progress.js";
import { BuildLog } from "../tracking/log.js";
import { gitCommit, isGitRepo, gitInit } from "../tracking/git.js";
import { writeJsonFile, writeText, ensureDir, readText, fileExists } from "../lib/fs.js";
import { CostLedger } from "../lib/cost.js";
import { runPreflight, formatPreflightForPrompt, formatPreflightOneLiner, autoFix } from "./preflight.js";
import { writeDecisionRequired, notifyHuman, readDecisionAnswer } from "./decisions.js";
import type { ShipwrightConfig } from "../config.js";
import type { DecisionRequest } from "./types.js";
import type {
  PipelineState,
  PipelineResult,
  SprintState,
  SprintContract,
  BuildAttempt,
  EvalResult,
  ScoutReport,
} from "./types.js";
import type { SprintPlan } from "../intake/types.js";

export async function runPipeline(
  config: ShipwrightConfig,
  prdPath: string,
  options: {
    dryRun?: boolean;
    sprintFilter?: number;
    noCommit?: boolean;
    noImprove?: boolean;
    noValidate?: boolean;
    verbose?: boolean;
  } = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const costLedger = new CostLedger();
  const stateDir = resolve(config.target.dir, ".shipwright");
  ensureDir(stateDir);
  const buildLog = new BuildLog(config, prdPath);

  // Set verbose flag for all agents
  setVerbose(options.verbose ?? false);

  // Ensure target is a git repo (for diff tracking)
  if (!isGitRepo(config.target.dir)) {
    gitInit(config.target.dir);
    // Initial commit so we have a baseline for diff
    try {
      execSync('git add -A && git commit -m "init: empty workspace" --allow-empty', {
        cwd: config.target.dir, stdio: "pipe",
      });
    } catch { /* may already have commits */ }
  }

  // --- Phase: PARSING ---
  log("PARSE", `Reading PRD: ${prdPath}`);
  const prd = parsePRD(prdPath);
  log("PARSE", `Title: ${prd.title}`);
  log("PARSE", `Acceptance criteria: ${prd.acceptanceCriteria.length}`);

  const allSprints = deriveSprints(prd);
  log("PARSE", `Derived ${allSprints.length} sprints`);

  const sprints = options.sprintFilter
    ? allSprints.filter((_, i) => i + 1 === options.sprintFilter)
    : allSprints;

  // Load expertise
  const expertise = loadExpertise(config.expertise.dir);
  const expertiseText = formatExpertiseForPrompt(expertise);
  if (expertise.files.length > 0) {
    log("EXPERTISE", `Loaded ${expertise.files.length} expertise files (${expertise.totalLines} lines)`);
  }

  // --- Phase: DOC_FETCH ---
  let vendorDocsDir: string | undefined;
  if (Object.keys(config.mcpServers).length > 0) {
    log("DOC_FETCH", "Fetching vendor documentation...");
    try {
      const { fetchVendorDocs } = await import("./doc-fetcher.js");
      const technologies = prd.technologies.length > 0 ? prd.technologies : [];

      if (technologies.length > 0) {
        log("DOC_FETCH", `Technologies: ${technologies.join(", ")}`);
        const docResult = await fetchVendorDocs(config, technologies, config.target.dir);
        vendorDocsDir = docResult.docsDir;
        log("DOC_FETCH", `Fetched: ${docResult.fetched.length}, Cached: ${docResult.cached.length}, Failed: ${docResult.failed.length}`);
        log("DOC_FETCH", `Docs at: ${docResult.docsDir}`);
        writeJsonFile(resolve(stateDir, "doc-fetch-result.json"), docResult);
      } else {
        log("DOC_FETCH", "No technologies identified in PRD. Skipping.");
      }
    } catch (err) {
      log("DOC_FETCH", `Doc fetch failed (non-fatal): ${err}`);
    }
  } else {
    log("DOC_FETCH", "No MCP servers configured. Skipping.");
  }

  // --- Phase: PRD VALIDATION ---
  if (!options.noValidate) {
    log("VALIDATE", "Validating PRD against vendor documentation...");
    try {
      const validationResult = await runValidator(config, prdPath, vendorDocsDir);
      writeJsonFile(resolve(stateDir, "validation-report.json"), validationResult);
      console.log(formatValidationReport(validationResult));

      if (validationResult.summary.verdict === "BLOCK") {
        log("VALIDATE", `🛑 PRD BLOCKED — ${validationResult.summary.critical} critical issues found.`);
        log("VALIDATE", "Fix the PRD before running Shipwright. See .shipwright/validation-report.json");

        return {
          prdPath,
          status: "failed",
          sprints: [],
          totalCostUsd: costLedger.totalCostUsd,
          totalDurationMs: Date.now() - startTime,
          expertiseFilesUpdated: [],
        };
      }

      if (validationResult.summary.verdict === "REVIEW") {
        log("VALIDATE", `⚠️  PRD has ${validationResult.summary.warning} warnings. Proceeding — review recommended.`);
      } else {
        log("VALIDATE", "✅ PRD validation passed.");
      }
    } catch (err) {
      log("VALIDATE", `Validation failed (non-fatal): ${err}`);
      log("VALIDATE", "Proceeding without validation — MCP servers may not be available.");
    }
  } else {
    log("VALIDATE", "Skipped (--no-validate flag).");
  }

  // --- Phase: PRE-FLIGHT ---
  log("PREFLIGHT", "Running environment discovery...");
  let preflightReport = runPreflight(resolve(config.target.dir));
  log("PREFLIGHT", formatPreflightOneLiner(preflightReport));

  // Auto-fix recoverable issues (start Docker, start Supabase)
  if (!preflightReport.database.dockerRunning.available || !preflightReport.database.postgres.available) {
    log("PREFLIGHT", "Attempting auto-fix for missing services...");
    const fixes = autoFix(preflightReport);
    for (const fix of fixes) {
      log("PREFLIGHT", `  → ${fix}`);
    }
    // Re-run preflight to get updated state
    if (fixes.length > 0) {
      preflightReport = runPreflight(resolve(config.target.dir));
      log("PREFLIGHT", formatPreflightOneLiner(preflightReport));
    }
  }

  writeJsonFile(resolve(stateDir, "environment.json"), preflightReport);
  const preflightText = formatPreflightForPrompt(preflightReport);

  // Initialize state
  const state: PipelineState = {
    prdPath,
    phase: "parsing",
    currentSprintIndex: 0,
    currentAttempt: 0,
    sprints: sprints.map((plan) => ({
      plan,
      status: "pending",
      attempts: [],
      expertiseUpdated: false,
      costUsd: 0,
      durationMs: 0,
    })),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalCostUsd: 0,
  };

  saveState(stateDir, state);

  // Check for pending decision answer (resume after decision pause)
  const decisionAnswer = readDecisionAnswer(stateDir);
  let decisionContext = "";
  if (decisionAnswer && decisionAnswer.answer) {
    log("DECISION", `Resuming with human decision: ${decisionAnswer.answer}`);
    decisionContext = [
      `\n## Human Decision`,
      `The human has answered a pending question:`,
      `Q: ${decisionAnswer.question}`,
      `A: ${decisionAnswer.answer}`,
      ``,
      `Incorporate this decision into your implementation.\n`,
    ].join("\n");
  }

  // --- Sprint Loop ---
  const sprintResults: PipelineResult["sprints"] = [];

  for (let i = 0; i < state.sprints.length; i++) {
    const sprintState = state.sprints[i];
    const sprint = sprintState.plan;
    state.currentSprintIndex = i;

    log("SPRINT", `\n${"=".repeat(60)}`);
    log("SPRINT", `Sprint ${i + 1}/${state.sprints.length}: ${sprint.title}`);
    log("SPRINT", `${"=".repeat(60)}`);

    const sprintStart = Date.now();
    sprintState.status = "in_progress";

    const sprintDir = resolve(stateDir, `sprint-${String(i + 1).padStart(3, "0")}`);
    ensureDir(sprintDir);
    buildLog.logSprintStart(i + 1, sprint.title);

    // --- Scout ---
    state.phase = "scouting";
    saveState(stateDir, state);
    log("SCOUT", "Running scouts...");

    let scoutReports: ScoutReport[] = [];
    try {
      scoutReports = await runScouts(config, sprint, expertiseText);
      const totalFiles = scoutReports.reduce((sum, r) => sum + (r.findings?.relevantFiles?.length ?? 0), 0);
      log("SCOUT", `Scouts complete. Found ${totalFiles} relevant files.`);
    } catch (err) {
      log("SCOUT", `Scout failed (non-fatal): ${err}`);
    }
    const scoutText = formatScoutReports(scoutReports);
    writeJsonFile(resolve(sprintDir, "scout-reports.json"), scoutReports);
    if (scoutReports.length > 0) {
      buildLog.logScoutReports(scoutReports);
    }

    if (options.dryRun) {
      log("DRY-RUN", "Dry run mode — skipping build and evaluation.");
      sprintResults.push({
        sprintId: sprint.id,
        status: "passed",
        attempts: 0,
        finalScore: 0,
        costUsd: 0,
        durationMs: Date.now() - sprintStart,
      });
      continue;
    }

    // --- Plan (written to file) ---
    state.phase = "planning";
    saveState(stateDir, state);
    const planFilePath = resolve(sprintDir, "plan.md");
    log("PLAN", `Running planner → ${planFilePath}`);

    const vendorDocsRef = vendorDocsDir
      ? `\n## Vendor Documentation\nLocal vendor docs available at: ${vendorDocsDir}\nRead ${resolve(vendorDocsDir, "INDEX.md")} for a list of all available docs. Include doc file paths in your plan so the generator can reference them.\n`
      : "";
    const contextForPlanner = scoutText + "\n\n" + preflightText + vendorDocsRef + decisionContext;
    const plannerResult = await runPlanner(config, sprint, planFilePath, prdPath, contextForPlanner, expertiseText);
    costLedger.record({ ...plannerResult.costEntry, sprintId: sprint.id });

    if (fileExists(planFilePath)) {
      const planContent = readText(planFilePath);
      const stepCount = (planContent.match(/^###\s+\d+\./gm) ?? []).length;
      log("PLAN", `Plan written: ${stepCount} steps, ${planContent.split("\n").length} lines`);
    } else {
      log("PLAN", "WARNING: Planner did not write plan file. Using sprint description as fallback.");
      writeText(planFilePath, `# Sprint Plan: ${sprint.title}\n\n${sprint.description}\n`);
    }

    // --- Build → Evaluate → Smart Retry Loop ---
    let passed = false;
    let lastEvalResult: EvalResult | undefined;
    let previousScore = 0;
    let planAmended = false;

    for (let attempt = 1; attempt <= config.pipeline.maxRetries; attempt++) {
      state.currentAttempt = attempt;
      state.phase = "building";
      saveState(stateDir, state);

      log("BUILD", `Attempt ${attempt}/${config.pipeline.maxRetries}...`);
      const attemptStart = Date.now();

      // --- Smart feedback routing based on failure categories ---
      let feedbackFilePath: string | undefined;
      if (lastEvalResult) {
        feedbackFilePath = resolve(sprintDir, `feedback-attempt-${attempt - 1}.json`);

        // Build incremental retry header — tell generator what passes and what fails
        const passingCriteria = lastEvalResult.scores.filter((s) => s.score >= 7);
        const failingCriteria = lastEvalResult.scores.filter((s) => s.score < 7);

        if (passingCriteria.length > 0) {
          const preserveSection = [
            `\n## PASSING CRITERIA — DO NOT TOUCH\n`,
            `These criteria already pass. Do NOT modify files related to them:\n`,
            ...passingCriteria.map((s) => `- ✓ ${s.criterionId}: ${s.score}/10 — ${s.criterion}`),
            ``,
          ].join("\n");

          const fixSection = [
            `## FAILING CRITERIA — FIX THESE ONLY\n`,
            `Focus exclusively on these failing criteria:\n`,
            ...failingCriteria.map((s) => {
              const cat = s.failureCategory ? ` [${s.failureCategory}]` : "";
              const details = s.reasoning ? `\n  → ${s.reasoning}` : "";
              const failures = (s.specificFailures ?? []).map((f) => `\n  → ${f}`).join("");
              return `- ✗ ${s.criterionId}: ${s.score}/10${cat} — ${s.criterion}${details}${failures}`;
            }),
            ``,
          ].join("\n");

          lastEvalResult.feedback = preserveSection + fixSection + "\n" + lastEvalResult.feedback;
        }

        writeJsonFile(feedbackFilePath, lastEvalResult);

        const categories = categoriseFailures(lastEvalResult);

        // TREND DETECTION: if score didn't improve, escalate
        if (attempt > 2 && lastEvalResult.overallScore <= previousScore) {
          log("TREND", `Score not improving (${previousScore} → ${lastEvalResult.overallScore}). Escalating.`);
          // Force plan amendment if not already done
          if (!planAmended) {
            categories.hasPlan = true;
          }
        }

        // ESCALATION: if INFRA failure repeats 2+ times without meaningful improvement, escalate to DECISION
        if (categories.hasInfra && attempt > 2) {
          const prevAttempt = sprintState.attempts[sprintState.attempts.length - 2];
          if (prevAttempt) {
            const prevCats = categoriseFailures(prevAttempt.evalResult);
            if (prevCats.hasInfra && (lastEvalResult.overallScore - prevAttempt.evalResult.overallScore) < 1.0) {
              log("ESCALATE", "INFRA failure repeating without meaningful improvement → escalating to DECISION");
              categories.hasDecision = true;
            }
          }
        }

        // DECISION failures → pause pipeline for human input
        if (categories.hasDecision) {
          log("DECISION", "DECISION failure detected → pausing pipeline for human input...");

          const decisionFailures = (lastEvalResult.failureCategories ?? [])
            .filter((f) => f.category === "decision")
            .map((f) => f.description);

          const decisionScores = lastEvalResult.scores
            .filter((s) => s.failureCategory === "decision" && s.score < 7)
            .map((s) => s.reasoning);

          const question = decisionFailures.join("; ") || decisionScores.join("; ") || "Unspecified decision needed — the evaluator found an issue that requires human judgement";

          const decision: DecisionRequest = {
            question,
            context: lastEvalResult.feedback.slice(0, 1000),
            options: [],
            sprint: sprint.id,
            attempt,
            timestamp: new Date().toISOString(),
          };

          writeDecisionRequired(stateDir, decision);
          notifyHuman(decision);

          state.phase = "awaiting_decision";
          saveState(stateDir, state);
          writeProgress(config, state);
          buildLog.logPipelineComplete("awaiting_decision", Date.now() - startTime, costLedger.totalCostUsd);
          buildLog.flush();

          return {
            prdPath,
            status: "awaiting_decision",
            sprints: sprintResults,
            totalCostUsd: costLedger.totalCostUsd,
            totalDurationMs: Date.now() - startTime,
            expertiseFilesUpdated: [],
          };
        }

        // PLAN failures → amend the plan before generator retries
        if (categories.hasPlan && !planAmended) {
          log("ROUTE", "PLAN failures detected → amending plan before retry...");
          state.phase = "planning";
          saveState(stateDir, state);

          const planFailures = (lastEvalResult.failureCategories ?? [])
            .filter((f) => f.category === "plan")
            .map((f) => f.description)
            .join("\n");

          const failedCriteria = lastEvalResult.scores
            .filter((s) => s.score < 7 && s.failureCategory === "plan")
            .map((s) => `- [${s.criterionId}] ${s.criterion}: ${s.reasoning}`)
            .join("\n");

          // Re-run planner with failure context
          const amendPrompt = [
            `The previous plan was incomplete. The evaluator found PLAN-level gaps.`,
            ``,
            `## Plan Failures`,
            planFailures || failedCriteria || lastEvalResult.feedback,
            ``,
            `Amend the plan at: ${planFilePath}`,
            `Add missing steps for the failures above. Keep existing steps that worked.`,
          ].join("\n");

          const amendResult = await runPlanner(config, sprint, planFilePath, prdPath, amendPrompt, expertiseText);
          costLedger.record({ ...amendResult.costEntry, sprintId: sprint.id });
          log("ROUTE", "Plan amended.");
          planAmended = true;
        }

        // INFRA failures → re-check environment + specific setup instructions + MCP docs
        if (categories.hasInfra) {
          log("ROUTE", "INFRA failures detected → re-running preflight + adding specific instructions...");

          // Re-run preflight to get CURRENT state (something may have changed since last attempt)
          const currentEnv = runPreflight(resolve(config.target.dir));
          writeJsonFile(resolve(stateDir, "environment.json"), currentEnv);

          const infraParts: string[] = [
            `\n## INFRASTRUCTURE SETUP REQUIRED\n`,
            `The evaluator found infrastructure problems. Here is the CURRENT environment state:\n`,
            formatPreflightForPrompt(currentEnv),
            ``,
            `BEFORE fixing any code issues, you MUST address each MISSING item above.`,
            ``,
          ];

          if (!currentEnv.envFile.exists) {
            infraParts.push(
              `### .env File Setup`,
              `Create ${resolve(config.target.dir, ".env")} with:`,
              `\`\`\``,
              `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
              `PAYLOAD_SECRET=dev-secret-change-in-production`,
              `SUPABASE_URL=http://127.0.0.1:54321`,
              `SUPABASE_SERVICE_KEY=<get from: supabase status --output json>`,
              `\`\`\``,
              ``,
            );
          }

          if (!currentEnv.database.dockerRunning.available) {
            infraParts.push(
              `### Docker Required`,
              `Docker must be installed and running for Supabase local dev.`,
              vendorDocsDir ? `Read local vendor docs at: ${vendorDocsDir}/supabase/` : `Check official Supabase documentation for local dev setup.`,
              ``,
            );
          }

          if (!currentEnv.database.supabaseCli.available) {
            infraParts.push(
              `### Supabase CLI Required`,
              `Install: brew install supabase/tap/supabase (or npm i -g supabase)`,
              `Then: supabase init && supabase start`,
              vendorDocsDir ? `Read local vendor docs at: ${vendorDocsDir}/supabase/` : `Check official Supabase CLI documentation.`,
              ``,
            );
          }

          if (!currentEnv.database.postgres.available && currentEnv.database.supabaseCli.available) {
            infraParts.push(
              `### Database Not Running`,
              `Supabase CLI is installed but PostgreSQL is not running on port 54322.`,
              `Run: supabase start (requires Docker to be running first)`,
              ``,
            );
          }

          infraParts.push(
            `### Documentation Access`,
            vendorDocsDir
              ? `Official vendor documentation is available locally at: ${vendorDocsDir}/`
              : `No local vendor docs available.`,
            vendorDocsDir
              ? `Read ${resolve(vendorDocsDir, "INDEX.md")} for a list of all available docs.`
              : ``,
            ``,
            `After setup, verify with: pnpm dev (should start without 500 errors)`,
          );

          const infraNote = infraParts.join("\n");
          const existingFeedback = lastEvalResult;
          existingFeedback.feedback = infraNote + "\n" + existingFeedback.feedback;
          writeJsonFile(feedbackFilePath, existingFeedback);
        }

        // CODE failures → standard retry (feedback already written)
        if (categories.hasCode && !categories.hasPlan && !categories.hasInfra) {
          log("ROUTE", "CODE failures only → standard generator retry with feedback.");
        }
      }

      previousScore = lastEvalResult?.overallScore ?? 0;

      // Build — generator reads plan file (and feedback file on retry)
      const generatorResult = await runGenerator(config, planFilePath, feedbackFilePath);
      costLedger.record({ ...generatorResult.costEntry, sprintId: sprint.id });
      log("BUILD", "Generator done.");

      // Detect what changed via git diff
      let filesChanged: string[] = [];
      try {
        const diffOutput = execSync("git diff --name-only HEAD", {
          cwd: config.target.dir, stdio: "pipe",
        }).toString().trim();
        const untrackedOutput = execSync("git ls-files --others --exclude-standard", {
          cwd: config.target.dir, stdio: "pipe",
        }).toString().trim();
        filesChanged = [
          ...diffOutput.split("\n").filter(Boolean),
          ...untrackedOutput.split("\n").filter(Boolean),
        ];
        log("BUILD", `Files changed: ${filesChanged.length}`);
      } catch {
        log("BUILD", "Could not detect file changes via git.");
      }

      if (filesChanged.length === 0) {
        log("BUILD", "WARNING: No files changed. Generator may have committed already.");
      }

      // Evaluate
      state.phase = "evaluating";
      saveState(stateDir, state);
      log("EVAL", "Running evaluator (adversarial)...");

      const { evalResult, costEntry: evalCostEntry } = await runEvaluator(config, contract(sprint, planFilePath), filesChanged);
      costLedger.record({ ...evalCostEntry, sprintId: sprint.id });

      const attemptRecord: BuildAttempt = {
        attempt,
        startedAt: new Date(attemptStart).toISOString(),
        completedAt: new Date().toISOString(),
        filesChanged,
        evalResult,
        costUsd: 0,
        durationMs: Date.now() - attemptStart,
      };
      sprintState.attempts.push(attemptRecord);

      // Save attempt
      const attemptDir = resolve(sprintDir, `attempt-${attempt}`);
      ensureDir(attemptDir);
      writeJsonFile(resolve(attemptDir, "eval-result.json"), evalResult);

      // Log the attempt
      buildLog.logBuildAttempt(attempt, evalResult);

      // Log per-criterion scores (always — pass or fail)
      if (evalResult.scores && evalResult.scores.length > 0) {
        log("EVAL", `┌─────────────────────────────────────────────────────────────`);
        for (const s of evalResult.scores) {
          const icon = s.score >= 7 ? "✓" : "✗";
          const cat = s.failureCategory ? ` [${s.failureCategory}]` : "";
          log("EVAL", `│ ${icon} ${s.criterionId}: ${s.score}/10${cat} — ${s.criterion}`);
          if (s.score < 7 && s.reasoning) {
            log("EVAL", `│   → ${s.reasoning.slice(0, 120)}`);
          }
        }
        log("EVAL", `└─────────────────────────────────────────────────────────────`);
      }

      if (evalResult.passed) {
        log("EVAL", `PASSED (score: ${evalResult.overallScore}/10)`);
        passed = true;
        break;
      } else {
        log("EVAL", `FAILED (score: ${evalResult.overallScore}/10)`);

        // Log failure categories
        const cats = categoriseFailures(evalResult);
        const catSummary = [
          cats.hasCode ? "CODE" : null,
          cats.hasPlan ? "PLAN" : null,
          cats.hasInfra ? "INFRA" : null,
          cats.hasDecision ? "DECISION" : null,
        ].filter(Boolean).join(" + ");
        log("EVAL", `Failure types: ${catSummary || "uncategorised"}`);

        lastEvalResult = evalResult;

        // TREND DETECTION: stop early if score dropped and we've tried twice
        if (attempt >= 2 && evalResult.overallScore < previousScore) {
          log("TREND", `Score DROPPED (${previousScore} → ${evalResult.overallScore}). Stopping early — more retries unlikely to help.`);
          break;
        }

        if (attempt < config.pipeline.maxRetries) {
          log("RETRY", `Retrying with smart routing...`);
        }
      }
    }

    // --- Sprint Result ---
    const sprintDuration = Date.now() - sprintStart;
    sprintState.durationMs = sprintDuration;
    const finalScore = sprintState.attempts[sprintState.attempts.length - 1]?.evalResult.overallScore ?? 0;

    if (passed) {
      sprintState.status = "passed";

      // Self-improve expertise
      if (config.expertise.autoImprove && !options.noImprove) {
        state.phase = "improving";
        saveState(stateDir, state);
        log("IMPROVE", "Running expertise improver...");

        try {
          const contractData = contract(sprint, planFilePath);
          const { update, costEntry: improveCostEntry } = await runImprover(config, contractData, sprintState.attempts, expertiseText);
          costLedger.record({ ...improveCostEntry, sprintId: sprint.id });
          if (update.newPatterns.length > 0 || update.newGotchas.length > 0 || update.newDecisions.length > 0) {
            const expertisePath = resolve(config.expertise.dir, `${update.domain}.yaml`);
            const { changesApplied } = applyExpertiseUpdate(expertisePath, update, config.expertise.maxLines);
            log("IMPROVE", `Updated ${update.domain}: ${changesApplied.length} changes`);
            buildLog.logExpertiseUpdate(update.domain, changesApplied);
            sprintState.expertiseUpdated = true;
          } else {
            log("IMPROVE", "No new learnings to record.");
          }
        } catch (err) {
          log("IMPROVE", `Expertise update failed (non-fatal): ${err}`);
        }
      }

      // Git commit the sprint
      state.phase = "committing";
      if (config.tracking.gitCommits && !options.noCommit) {
        log("COMMIT", `Committing: ${sprint.title}`);
        const hash = gitCommit(config.target.dir, sprint.title, config.tracking.commitPrefix);
        if (hash) {
          sprintState.commitHash = hash;
          log("COMMIT", `Committed: ${hash}`);
          buildLog.logCommit(hash);
        }
      }

      buildLog.logSprintComplete(i + 1, "passed", finalScore, sprintDuration);
      sprintResults.push({
        sprintId: sprint.id,
        status: "passed",
        attempts: sprintState.attempts.length,
        finalScore,
        commitHash: sprintState.commitHash,
        costUsd: sprintState.costUsd,
        durationMs: sprintDuration,
      });
    } else {
      sprintState.status = "failed";
      log("FAIL", `Sprint failed after ${config.pipeline.maxRetries} attempts.`);
      buildLog.logSprintComplete(i + 1, "failed", finalScore, sprintDuration);
      sprintResults.push({
        sprintId: sprint.id,
        status: "failed",
        attempts: sprintState.attempts.length,
        finalScore,
        costUsd: sprintState.costUsd,
        durationMs: sprintDuration,
      });
      state.phase = "failed";
      saveState(stateDir, state);
      writeProgress(config, state);
      buildLog.flush();
      break;
    }

    saveState(stateDir, state);
    writeProgress(config, state);
    buildLog.flush();
  }

  // --- Final Result ---
  const totalDuration = Date.now() - startTime;
  const allPassed = sprintResults.every((s) => s.status === "passed");

  state.phase = allPassed ? "complete" : "failed";
  state.totalCostUsd = costLedger.totalCostUsd;
  saveState(stateDir, state);
  writeProgress(config, state);
  buildLog.logPipelineComplete(allPassed ? "complete" : "failed", totalDuration, costLedger.totalCostUsd);
  buildLog.flush();

  const result: PipelineResult = {
    prdPath,
    status: allPassed ? "complete" : "failed",
    sprints: sprintResults,
    totalCostUsd: costLedger.totalCostUsd,
    totalDurationMs: totalDuration,
    expertiseFilesUpdated: [],
  };

  // --- Build Summary ---
  const fmtDur = (ms: number) => {
    if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  };
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const fmtCost = (n: number) => `$${n.toFixed(2)}`;

  console.log(`\n⚓ Build ${result.status === "complete" ? "Complete" : "Failed"} — ${prd.title}`);
  console.log(`${"═".repeat(80)}`);
  console.log(`${"Sprint".padEnd(40)} ${"Score".padStart(7)} ${"Tries".padStart(6)} ${"Time".padStart(8)} ${"Tokens".padStart(8)} ${"API Cost".padStart(9)}`);
  console.log(`${"─".repeat(80)}`);

  let totalTokens = 0;
  let totalApiCost = 0;

  for (const sr of sprintResults) {
    const sprintPlan = sprints.find((s) => s.id === sr.sprintId);
    const name = (sprintPlan?.title ?? sr.sprintId).slice(0, 38);
    const score = sr.finalScore > 0 ? `${sr.finalScore}/10` : "—";
    const tokens = costLedger.tokensForSprint(sr.sprintId);
    const apiCost = costLedger.apiCostForSprint(sr.sprintId);
    totalTokens += tokens.total;
    totalApiCost += apiCost;

    console.log(
      `${(sr.status === "passed" ? "✓" : "✗")} ${name.padEnd(38)} ${score.padStart(7)} ${String(sr.attempts).padStart(6)} ${fmtDur(sr.durationMs).padStart(8)} ${fmtTokens(tokens.total).padStart(8)} ${fmtCost(apiCost).padStart(9)}`
    );
  }

  console.log(`${"─".repeat(80)}`);
  console.log(
    `  ${"TOTAL".padEnd(38)} ${`${(sprintResults.reduce((s, r) => s + r.finalScore, 0) / sprintResults.length).toFixed(1)} avg`.padStart(7)} ${String(sprintResults.reduce((s, r) => s + r.attempts, 0)).padStart(6)} ${fmtDur(totalDuration).padStart(8)} ${fmtTokens(totalTokens).padStart(8)} ${fmtCost(totalApiCost).padStart(9)}`
  );

  // Token breakdown by agent
  const agents = ["generator", "evaluator", "planner", "scout", "validator", "improver", "negotiator"];
  const agentTokens = agents.map((a) => ({ agent: a, tokens: costLedger.tokensForAgent(a) })).filter((a) => a.tokens > 0);
  if (agentTokens.length > 0) {
    console.log(`\nTokens by agent:`);
    for (const { agent, tokens } of agentTokens.sort((a, b) => b.tokens - a.tokens)) {
      const pct = totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0;
      console.log(`  ${agent.padEnd(14)} ${fmtTokens(tokens).padStart(8)} (${pct}%)`);
    }
  }

  console.log(`\n  Pricing: Subscription (actual cost: $0). API pricing shown for reference.`);
  console.log(`${"═".repeat(80)}\n`);

  // Generate handover report if build succeeded
  if (allPassed) {
    try {
      const { generateHandover } = await import("../tracking/handover.js");
      generateHandover(config, state, sprintResults, costLedger, prd);
      log("HANDOVER", `Report written to ${resolve(config.target.dir, "HANDOVER.md")}`);
    } catch (err) {
      log("HANDOVER", `Failed to generate handover report: ${err}`);
    }
  }

  return result;
}

// --- Helpers ---

/**
 * Build a minimal SprintContract for the evaluator and improver.
 * The contract references the plan file for full details.
 */
function contract(sprint: SprintPlan, planFilePath: string): SprintContract {
  return {
    sprintId: sprint.id,
    title: sprint.title,
    acceptanceCriteria: sprint.acceptanceCriteria,
    implementation: {
      steps: [],
      filesToCreate: sprint.fileTargets,
      filesToModify: [],
      validationCommands: sprint.acceptanceCriteria
        .filter((ac) => ac.validationCommand)
        .map((ac) => ac.validationCommand!),
    },
    evaluationCriteria: [],
    negotiationRounds: [],
    signedAt: new Date().toISOString(),
  };
}

function saveState(stateDir: string, state: PipelineState): void {
  state.updatedAt = new Date().toISOString();
  writeJsonFile(resolve(stateDir, "state.json"), state);
}

function log(phase: string, message: string): void {
  const timestamp = new Date().toISOString().split("T")[1].replace("Z", "");
  console.log(`[${timestamp}] [${phase.padEnd(8)}] ${message}`);
}

/**
 * Categorise eval failures into CODE, PLAN, INFRA, DECISION.
 * Uses explicit categories from evaluator output, with heuristic fallback.
 */
function categoriseFailures(evalResult: EvalResult): {
  hasCode: boolean;
  hasPlan: boolean;
  hasInfra: boolean;
  hasDecision: boolean;
} {
  let hasCode = false;
  let hasPlan = false;
  let hasInfra = false;
  let hasDecision = false;

  // Strategy 1: Use explicit categories from evaluator (Codex schema or structured markdown)
  if (evalResult.failureCategories && evalResult.failureCategories.length > 0) {
    for (const cat of evalResult.failureCategories) {
      if (cat.category === "code") hasCode = true;
      if (cat.category === "plan") hasPlan = true;
      if (cat.category === "infra") hasInfra = true;
      if (cat.category === "decision") hasDecision = true;
    }
    return { hasCode, hasPlan, hasInfra, hasDecision };
  }

  // Strategy 2: Use per-score categories
  for (const score of evalResult.scores ?? []) {
    if (score.score >= 7) continue;
    if (score.failureCategory === "code") hasCode = true;
    else if (score.failureCategory === "plan") hasPlan = true;
    else if (score.failureCategory === "infra") hasInfra = true;
    else if (score.failureCategory === "decision") hasDecision = true;
  }
  if (hasCode || hasPlan || hasInfra || hasDecision) return { hasCode, hasPlan, hasInfra, hasDecision };

  // Strategy 3: Heuristic — scan feedback text for keywords
  // CODE keywords are checked first and take priority when mixed with INFRA keywords.
  // This prevents "type-check failed → server returned 500" from being classified as INFRA
  // when the root cause is a TypeScript error.
  const text = (evalResult.feedback + " " + evalResult.failureReasons.join(" ")).toLowerCase();

  const codeKeywords = ["type error", "type-check", "cannot find module", "is not assignable",
    "property does not exist", "typescript", "tsc", "compilation error", "syntax error",
    "import error", "not assignable to type", "does not exist on type", "expected",
    "unexpected token", "cannot find name"];
  const decisionKeywords = ["unclear which", "not specified", "ambiguous", "could be either",
    "no configuration for", "which database", "which provider", "human must decide",
    "requires a choice", "not determined", "which auth", "which api version"];
  const infraKeywords = [".env", "database_url", "missing env", "dependencies not installed",
    "pnpm install", "npm install", "econnrefused", "not configured", "not running",
    "docker", "supabase", "no database"];
  const planKeywords = ["missing from plan", "not in plan", "should have been created",
    "no api route", "directory does not exist", "file not found", "missing step",
    "incomplete", "not implemented", "was not created"];

  // Check CODE first — if code errors exist, they're likely the root cause of 500s
  for (const kw of codeKeywords) {
    if (text.includes(kw)) { hasCode = true; break; }
  }
  for (const kw of decisionKeywords) {
    if (text.includes(kw)) { hasDecision = true; break; }
  }
  // Only check INFRA if no code errors found — prevents "500" from overriding type errors
  if (!hasCode) {
    for (const kw of infraKeywords) {
      if (text.includes(kw)) { hasInfra = true; break; }
    }
  }
  for (const kw of planKeywords) {
    if (text.includes(kw)) { hasPlan = true; break; }
  }

  // Default: if nothing matched, assume code issue
  if (!hasInfra && !hasPlan && !hasDecision && !hasCode) hasCode = true;

  return { hasCode, hasPlan, hasInfra, hasDecision };
}
