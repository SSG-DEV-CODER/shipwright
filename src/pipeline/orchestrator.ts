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
import { runScouts, formatScoutReports } from "../agents/scout.js";
import { runPlanner } from "../agents/planner.js";
import { runGenerator } from "../agents/generator.js";
import { runEvaluator } from "../agents/evaluator.js";
import { runImprover } from "../agents/improver.js";
import { applyExpertiseUpdate } from "../expertise/updater.js";
import { writeProgress } from "../tracking/progress.js";
import { BuildLog } from "../tracking/log.js";
import { gitCommit, isGitRepo, gitInit } from "../tracking/git.js";
import { writeJsonFile, writeText, ensureDir, readText, fileExists } from "../lib/fs.js";
import { CostLedger } from "../lib/cost.js";
import type { ShipwrightConfig } from "../config.js";
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
    verbose?: boolean;
  } = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const costLedger = new CostLedger();
  const stateDir = resolve(config.target.dir, ".shipwright");
  ensureDir(stateDir);
  const buildLog = new BuildLog(config, prdPath);

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

    await runPlanner(config, sprint, planFilePath, prdPath, scoutText, expertiseText);

    if (fileExists(planFilePath)) {
      const planContent = readText(planFilePath);
      const stepCount = (planContent.match(/^###\s+\d+\./gm) ?? []).length;
      log("PLAN", `Plan written: ${stepCount} steps, ${planContent.split("\n").length} lines`);
    } else {
      log("PLAN", "WARNING: Planner did not write plan file. Using sprint description as fallback.");
      writeText(planFilePath, `# Sprint Plan: ${sprint.title}\n\n${sprint.description}\n`);
    }

    // --- Build → Evaluate → Retry Loop ---
    let passed = false;
    let lastEvalResult: EvalResult | undefined;

    // Capture git state before build for diff
    let preCommitHash = "";
    try {
      preCommitHash = execSync("git rev-parse HEAD", { cwd: config.target.dir, stdio: "pipe" }).toString().trim();
    } catch { /* no commits yet */ }

    for (let attempt = 1; attempt <= config.pipeline.maxRetries; attempt++) {
      state.currentAttempt = attempt;
      state.phase = "building";
      saveState(stateDir, state);

      log("BUILD", `Attempt ${attempt}/${config.pipeline.maxRetries}...`);
      const attemptStart = Date.now();

      // Write feedback file for retries
      let feedbackFilePath: string | undefined;
      if (lastEvalResult) {
        feedbackFilePath = resolve(sprintDir, `feedback-attempt-${attempt - 1}.json`);
        writeJsonFile(feedbackFilePath, lastEvalResult);
      }

      // Build — generator reads plan file (and feedback file on retry)
      await runGenerator(config, planFilePath, feedbackFilePath);
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

      // Check if generator actually did anything
      if (filesChanged.length === 0) {
        log("BUILD", "WARNING: No files changed. Generator may have failed silently.");
      }

      // Evaluate — Codex evaluator inspects the filesystem
      state.phase = "evaluating";
      saveState(stateDir, state);
      log("EVAL", "Running evaluator (adversarial)...");

      const evalResult = await runEvaluator(config, contract(sprint, planFilePath), filesChanged);

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

      if (evalResult.passed) {
        log("EVAL", `PASSED (score: ${evalResult.overallScore}/10)`);
        passed = true;
        break;
      } else {
        log("EVAL", `FAILED (score: ${evalResult.overallScore}/10)`);
        log("EVAL", `Failures: ${(evalResult.failureReasons ?? []).join("; ")}`);
        lastEvalResult = evalResult;

        if (attempt < config.pipeline.maxRetries) {
          log("RETRY", `Retrying with feedback...`);
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
          const update = await runImprover(config, contractData, sprintState.attempts, expertiseText);
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

  log("DONE", `\nPipeline ${result.status}. ${sprintResults.length} sprints, ${totalDuration}ms total.`);

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
