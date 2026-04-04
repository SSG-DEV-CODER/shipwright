/**
 * Campaign Runner — validate-all and build-all loops for multi-PRD campaigns
 *
 * Uses the validation cache so only changed PRDs are re-validated.
 * Builds phases sequentially, stopping on first failure.
 */

import { resolve } from "path";
import { loadConfig, applyCliOverrides } from "../config.js";
import { runPipeline } from "../pipeline/orchestrator.js";
import {
  hashPrd,
  readCache,
  writeCache,
  isCacheValid,
  shouldDowngradeCriticals,
  updateCache,
} from "../pipeline/validation-cache.js";
import { ensureDir } from "../lib/fs.js";
import type { CampaignManifest } from "./manifest.js";
import type { ShipwrightConfig } from "../config.js";
import type { PipelineResult } from "../pipeline/types.js";

// --- Validation ---

export interface PhaseValidationResult {
  phaseIndex: number;
  label: string;
  prd: string;
  verdict: "PASS" | "REVIEW" | "BLOCK" | "DOWNGRADED";
  cached: boolean;

  critical: number;
  warning: number;
  info: number;
}

export interface CampaignValidationResult {
  phases: PhaseValidationResult[];
  passed: number;
  review: number;
  blocked: number;
}

export async function validateCampaign(
  manifest: CampaignManifest,
  config: ShipwrightConfig,
  options: { forceValidate?: boolean } = {}
): Promise<CampaignValidationResult> {
  const stateDir = resolve(config.target.dir, ".shipwright");
  ensureDir(stateDir);
  const cache = readCache(stateDir);

  const results: PhaseValidationResult[] = [];

  for (let i = 0; i < manifest.phases.length; i++) {
    const phase = manifest.phases[i];
    const prdHash = hashPrd(phase.prd);

    // Check cache
    if (!options.forceValidate && isCacheValid(cache, phase.prd, prdHash)) {
      const entry = cache.entries[phase.prd];
      results.push({
        phaseIndex: i + 1,
        label: phase.label,
        prd: phase.prd,
        verdict: entry.verdict,
        cached: true,
        critical: entry.critical,
        warning: entry.warning,
        info: entry.info,
      });
      continue;
    }

    // Check if max passes reached — downgrade
    if (!options.forceValidate && shouldDowngradeCriticals(cache, phase.prd)) {
      results.push({
        phaseIndex: i + 1,
        label: phase.label,
        prd: phase.prd,
        verdict: "DOWNGRADED",
        cached: false,
        critical: 0,
        warning: cache.entries[phase.prd]?.warning ?? 0,
        info: cache.entries[phase.prd]?.info ?? 0,
      });
      continue;
    }

    // Run validator
    console.log(`\n  Validating Phase ${i + 1}: ${phase.label}...`);
    try {
      const { runValidator } = await import("../agents/validator.js");
      const validationResult = await runValidator(config, phase.prd);

      const verdict = validationResult.summary.verdict as "PASS" | "REVIEW" | "BLOCK";

      updateCache(cache, phase.prd, prdHash, verdict, {
        critical: validationResult.summary.critical,
        warning: validationResult.summary.warning,
        info: validationResult.summary.info,
      });
      writeCache(stateDir, cache);

      // Check downgrade after updating pass count
      let effectiveVerdict: "PASS" | "REVIEW" | "BLOCK" | "DOWNGRADED" = verdict;
      if (verdict === "BLOCK" && shouldDowngradeCriticals(cache, phase.prd)) {
        effectiveVerdict = "DOWNGRADED";
      }

      results.push({
        phaseIndex: i + 1,
        label: phase.label,
        prd: phase.prd,
        verdict: effectiveVerdict,
        cached: false,
        critical: validationResult.summary.critical,
        warning: validationResult.summary.warning,
        info: validationResult.summary.info,
      });
    } catch (err) {
      console.error(`  Validation error for Phase ${i + 1}: ${err}`);
      results.push({
        phaseIndex: i + 1,
        label: phase.label,
        prd: phase.prd,
        verdict: "BLOCK",
        cached: false,
        critical: 1,
        warning: 0,
        info: 0,
      });
    }
  }

  const passed = results.filter((r) => r.verdict === "PASS").length;
  const review = results.filter((r) => r.verdict === "REVIEW" || r.verdict === "DOWNGRADED").length;
  const blocked = results.filter((r) => r.verdict === "BLOCK").length;

  return { phases: results, passed, review, blocked };
}

export function formatValidationSummary(result: CampaignValidationResult, manifestPath: string): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("⚓ Campaign Validation Summary");
  lines.push("═══════════════════════════════════════════════════");

  for (const phase of result.phases) {
    const num = `Phase ${phase.phaseIndex}`;
    const label = phase.label;
    let status: string;

    switch (phase.verdict) {
      case "PASS":
        status = phase.cached ? "✅ PASS (cached)" : "✅ PASS";
        break;
      case "REVIEW":
        status = `⚠️  REVIEW — ${phase.warning} warning${phase.warning !== 1 ? "s" : ""}`;
        break;
      case "DOWNGRADED":
        status = `⚠️  DOWNGRADED — criticals waived after 3 passes`;
        break;
      case "BLOCK":
        status = `🛑 BLOCK — ${phase.critical} critical${phase.critical !== 1 ? "s" : ""}`;
        break;
    }

    lines.push(`  ${num}: ${label.padEnd(35)} ${status}`);
  }

  lines.push("═══════════════════════════════════════════════════");
  lines.push(`  Result: ${result.passed} passed, ${result.review} review, ${result.blocked} blocked`);

  if (result.blocked > 0) {
    const blockedPhases = result.phases
      .filter((p) => p.verdict === "BLOCK")
      .map((p) => `Phase ${p.phaseIndex}`)
      .join(", ");
    lines.push("");
    lines.push(`  Fix ${blockedPhases} critical issues, then re-run.`);
    lines.push(`  Only changed PRDs will be re-validated (others cached).`);
  }

  lines.push("");
  return lines.join("\n");
}

// --- Build ---

export interface PhaseBuildResult {
  phaseIndex: number;
  label: string;
  prd: string;
  status: "complete" | "failed" | "skipped";
  sprintCount: number;
  durationMs: number;
  finalScore?: number;
  failedSprint?: string;
  pipelineResult?: PipelineResult;
}

export interface CampaignBuildResult {
  phases: PhaseBuildResult[];
  completedCount: number;
  totalCount: number;
  failedAt?: { phaseIndex: number; label: string };
  totalDurationMs: number;
}

export async function buildCampaign(
  manifest: CampaignManifest,
  config: ShipwrightConfig,
  options: {
    from?: number;
    only?: number;
    noCommit?: boolean;
    noImprove?: boolean;
    verbose?: boolean;
  } = {}
): Promise<CampaignBuildResult> {
  const totalStart = Date.now();
  const results: PhaseBuildResult[] = [];

  for (let i = 0; i < manifest.phases.length; i++) {
    const phaseNum = i + 1;
    const phase = manifest.phases[i];

    // --only: build only this phase
    if (options.only && phaseNum !== options.only) {
      results.push({
        phaseIndex: phaseNum,
        label: phase.label,
        prd: phase.prd,
        status: "skipped",
        sprintCount: 0,
        durationMs: 0,
      });
      continue;
    }

    // --from: skip phases before N
    if (options.from && phaseNum < options.from) {
      results.push({
        phaseIndex: phaseNum,
        label: phase.label,
        prd: phase.prd,
        status: "skipped",
        sprintCount: 0,
        durationMs: 0,
      });
      continue;
    }

    console.log(`\n═══ Phase ${phaseNum}/${manifest.phases.length}: ${phase.label} ═══`);

    const phaseStart = Date.now();
    try {
      const pipelineResult = await runPipeline(config, phase.prd, {
        noValidate: true, // validation already done via campaign validate
        noCommit: options.noCommit,
        noImprove: options.noImprove,
        verbose: options.verbose,
      });

      const durationMs = Date.now() - phaseStart;

      if (pipelineResult.status === "complete") {
        const sprintCount = pipelineResult.sprints.length;
        console.log(`\n═══ Phase ${phaseNum}/${manifest.phases.length} COMPLETE: ${phase.label} (${sprintCount} sprint${sprintCount !== 1 ? "s" : ""}, ${formatDuration(durationMs)}) ═══`);

        results.push({
          phaseIndex: phaseNum,
          label: phase.label,
          prd: phase.prd,
          status: "complete",
          sprintCount,
          durationMs,
          pipelineResult,
        });
      } else {
        // Failed
        const failedSprint = pipelineResult.sprints.find((s) => s.status === "failed");
        const failedDesc = failedSprint
          ? `sprint ${failedSprint.sprintId} (score: ${failedSprint.finalScore}/10)`
          : "unknown sprint";

        results.push({
          phaseIndex: phaseNum,
          label: phase.label,
          prd: phase.prd,
          status: "failed",
          sprintCount: pipelineResult.sprints.length,
          durationMs,
          failedSprint: failedDesc,
          pipelineResult,
        });

        // Stop campaign on failure
        break;
      }
    } catch (err) {
      const durationMs = Date.now() - phaseStart;
      console.error(`\n  Phase ${phaseNum} error: ${err}`);
      results.push({
        phaseIndex: phaseNum,
        label: phase.label,
        prd: phase.prd,
        status: "failed",
        sprintCount: 0,
        durationMs,
        failedSprint: `error: ${err}`,
      });
      break;
    }
  }

  const completedCount = results.filter((r) => r.status === "complete").length;
  const failedPhase = results.find((r) => r.status === "failed");

  return {
    phases: results,
    completedCount,
    totalCount: manifest.phases.length,
    failedAt: failedPhase
      ? { phaseIndex: failedPhase.phaseIndex, label: failedPhase.label }
      : undefined,
    totalDurationMs: Date.now() - totalStart,
  };
}

export function formatBuildSummary(result: CampaignBuildResult, manifestPath: string): string {
  const lines: string[] = [];
  lines.push("");

  if (!result.failedAt) {
    lines.push("⚓ Campaign Complete");
  } else {
    lines.push("⚓ Campaign Stopped");
  }

  lines.push("═══════════════════════════════════════════════════");

  for (const phase of result.phases) {
    const num = `Phase ${phase.phaseIndex}`;
    let status: string;

    switch (phase.status) {
      case "complete":
        status = `✅ ${phase.sprintCount} sprint${phase.sprintCount !== 1 ? "s" : ""}, ${formatDuration(phase.durationMs)}`;
        break;
      case "failed":
        status = `❌ FAILED ${phase.failedSprint ?? ""}`;
        break;
      case "skipped":
        status = `⏭️  skipped`;
        break;
    }

    lines.push(`  ${num}: ${phase.label.padEnd(35)} ${status}`);
  }

  lines.push("═══════════════════════════════════════════════════");
  lines.push(`  Completed: ${result.completedCount}/${result.totalCount} phases`);

  if (result.failedAt) {
    lines.push(`  Failed at: Phase ${result.failedAt.phaseIndex} — ${result.failedAt.label}`);
    lines.push(`  Resume with: shipwright campaign build ${manifestPath} --from ${result.failedAt.phaseIndex}`);
  }

  lines.push(`  Total time: ${formatDuration(result.totalDurationMs)}`);
  lines.push("");
  return lines.join("\n");
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
