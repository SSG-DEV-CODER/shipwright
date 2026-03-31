/**
 * Pipeline Orchestrator — the main adversarial build loop
 *
 * For each sprint: Scout → Plan → Build → Evaluate → Retry → Improve → Commit
 */

import { resolve } from "path";
import { parsePRD } from "../intake/prd-parser.js";
import { deriveSprints } from "../intake/sprint-planner.js";
import { loadExpertise, formatExpertiseForPrompt } from "../expertise/loader.js";
import { runScouts, formatScoutReports } from "../agents/scout.js";
import { runPlanner } from "../agents/planner.js";
import { runGenerator } from "../agents/generator.js";
import { runEvaluator } from "../agents/evaluator.js";
import { writeJsonFile, ensureDir } from "../lib/fs.js";
import { CostLedger } from "../lib/cost.js";
import type { ShipwrightConfig } from "../config.js";
import type {
  PipelineState,
  PipelineResult,
  SprintState,
  SprintContract,
  BuildAttempt,
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

  // --- Phase: PARSING ---
  log("PARSE", `Reading PRD: ${prdPath}`);
  const prd = parsePRD(prdPath);
  log("PARSE", `Title: ${prd.title}`);
  log("PARSE", `Acceptance criteria: ${prd.acceptanceCriteria.length}`);

  const allSprints = deriveSprints(prd);
  log("PARSE", `Derived ${allSprints.length} sprints`);

  // Filter to specific sprint if requested
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
    state.phase = "scouting";

    log("SPRINT", `\n${"=".repeat(60)}`);
    log("SPRINT", `Sprint ${i + 1}/${state.sprints.length}: ${sprint.title}`);
    log("SPRINT", `${"=".repeat(60)}`);

    const sprintStart = Date.now();
    sprintState.status = "in_progress";

    // --- Scout ---
    state.phase = "scouting";
    saveState(stateDir, state);
    log("SCOUT", `Running ${Math.min(config.pipeline.maxScouts, 3)} scouts...`);

    let scoutReports: ScoutReport[] = [];
    try {
      scoutReports = await runScouts(config, sprint, expertiseText);
      log("SCOUT", `Scouts complete. Found ${scoutReports.reduce((sum, r) => sum + r.findings.relevantFiles.length, 0)} relevant files.`);
    } catch (err) {
      log("SCOUT", `Scout failed (non-fatal): ${err}`);
    }
    const scoutText = formatScoutReports(scoutReports);

    // Save scout reports
    const sprintDir = resolve(stateDir, `sprint-${String(i + 1).padStart(3, "0")}`);
    ensureDir(sprintDir);
    writeJsonFile(resolve(sprintDir, "scout-reports.json"), scoutReports);

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

    // --- Plan ---
    state.phase = "planning";
    saveState(stateDir, state);
    log("PLAN", "Running planner...");

    const plannerOutput = await runPlanner(config, sprint, scoutText, expertiseText);
    log("PLAN", `Plan: ${plannerOutput.steps.length} steps, ${plannerOutput.filesToCreate.length} files to create`);

    // Build contract from planner output + acceptance criteria
    const contract: SprintContract = {
      sprintId: sprint.id,
      title: sprint.title,
      acceptanceCriteria: sprint.acceptanceCriteria,
      implementation: {
        steps: plannerOutput.steps.map((s) => ({
          order: s.order,
          description: s.description,
          targetFiles: s.targetFiles,
        })),
        filesToCreate: plannerOutput.filesToCreate,
        filesToModify: plannerOutput.filesToModify,
        validationCommands: plannerOutput.validationCommands.length > 0
          ? plannerOutput.validationCommands
          : [config.target.typecheckCmd],
      },
      evaluationCriteria: plannerOutput.evaluationCriteria.map((ec, idx) => ({
        id: `eval-${String(idx + 1).padStart(3, "0")}`,
        criterion: ec.criterion,
        weight: 1 / (plannerOutput.evaluationCriteria.length || 1),
        specificChecks: ec.specificChecks,
      })),
      negotiationRounds: [],
      signedAt: new Date().toISOString(),
    };

    sprintState.contract = contract;
    writeJsonFile(resolve(sprintDir, "contract.json"), contract);

    // --- Build → Evaluate → Retry Loop ---
    let passed = false;
    let lastEvalResult = undefined;

    for (let attempt = 1; attempt <= config.pipeline.maxRetries; attempt++) {
      state.currentAttempt = attempt;
      state.phase = "building";
      saveState(stateDir, state);

      log("BUILD", `Attempt ${attempt}/${config.pipeline.maxRetries}...`);
      const attemptStart = Date.now();

      // Build
      const genOutput = await runGenerator(
        config,
        contract,
        scoutText,
        expertiseText,
        lastEvalResult
      );
      log("BUILD", `Generator done. Created: ${genOutput.filesCreated.length}, Modified: ${genOutput.filesModified.length}`);

      // Evaluate
      state.phase = "evaluating";
      saveState(stateDir, state);
      log("EVAL", "Running evaluator (adversarial)...");

      const filesChanged = [...genOutput.filesCreated, ...genOutput.filesModified];
      const evalResult = await runEvaluator(config, contract, filesChanged);

      const attemptRecord: BuildAttempt = {
        attempt,
        startedAt: new Date(attemptStart).toISOString(),
        completedAt: new Date().toISOString(),
        filesChanged,
        evalResult,
        costUsd: 0, // TODO: wire up cost tracking from agent results
        durationMs: Date.now() - attemptStart,
      };
      sprintState.attempts.push(attemptRecord);

      // Save attempt
      const attemptDir = resolve(sprintDir, `attempt-${attempt}`);
      ensureDir(attemptDir);
      writeJsonFile(resolve(attemptDir, "generator-output.json"), genOutput);
      writeJsonFile(resolve(attemptDir, "eval-result.json"), evalResult);

      if (evalResult.passed) {
        log("EVAL", `✅ PASSED (score: ${evalResult.overallScore}/10)`);
        passed = true;
        break;
      } else {
        log("EVAL", `❌ FAILED (score: ${evalResult.overallScore}/10)`);
        log("EVAL", `Failures: ${evalResult.failureReasons.join("; ")}`);
        lastEvalResult = evalResult;

        if (attempt < config.pipeline.maxRetries) {
          log("RETRY", `Retrying with feedback...`);
        }
      }
    }

    // --- Sprint Result ---
    const sprintDuration = Date.now() - sprintStart;
    sprintState.durationMs = sprintDuration;

    if (passed) {
      sprintState.status = "passed";
      state.phase = "committing";

      // Git commit (if enabled)
      if (config.tracking.gitCommits && !options.noCommit) {
        log("COMMIT", `Committing sprint: ${contract.title}`);
        try {
          const { execSync } = await import("child_process");
          execSync(`git add -A`, { cwd: config.target.dir, stdio: "pipe" });
          execSync(
            `git commit -m "${config.tracking.commitPrefix} ${contract.title}"`,
            { cwd: config.target.dir, stdio: "pipe" }
          );
          log("COMMIT", "Committed successfully.");
        } catch {
          log("COMMIT", "Git commit failed (non-fatal).");
        }
      }

      sprintResults.push({
        sprintId: sprint.id,
        status: "passed",
        attempts: sprintState.attempts.length,
        finalScore: sprintState.attempts[sprintState.attempts.length - 1]?.evalResult.overallScore ?? 0,
        commitHash: undefined, // TODO: capture from git
        costUsd: sprintState.costUsd,
        durationMs: sprintDuration,
      });
    } else {
      sprintState.status = "failed";
      log("FAIL", `Sprint failed after ${config.pipeline.maxRetries} attempts.`);

      sprintResults.push({
        sprintId: sprint.id,
        status: "failed",
        attempts: sprintState.attempts.length,
        finalScore: sprintState.attempts[sprintState.attempts.length - 1]?.evalResult.overallScore ?? 0,
        costUsd: sprintState.costUsd,
        durationMs: sprintDuration,
      });

      // Stop pipeline on sprint failure
      state.phase = "failed";
      saveState(stateDir, state);
      break;
    }

    saveState(stateDir, state);
  }

  // --- Final Result ---
  const totalDuration = Date.now() - startTime;
  const allPassed = sprintResults.every((s) => s.status === "passed");

  state.phase = allPassed ? "complete" : "failed";
  state.totalCostUsd = costLedger.totalCostUsd;
  saveState(stateDir, state);

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

function saveState(stateDir: string, state: PipelineState): void {
  state.updatedAt = new Date().toISOString();
  writeJsonFile(resolve(stateDir, "state.json"), state);
}

function log(phase: string, message: string): void {
  const timestamp = new Date().toISOString().split("T")[1].replace("Z", "");
  console.log(`[${timestamp}] [${phase.padEnd(8)}] ${message}`);
}
