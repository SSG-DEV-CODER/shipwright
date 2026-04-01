/**
 * PROGRESS.md auto-writer — updates progress file at every pipeline stage
 */

import { resolve } from "path";
import { writeText, fileExists, readText } from "../lib/fs.js";
import { statusEmoji, timestamp } from "../lib/markdown.js";
import type { PipelineState } from "../pipeline/types.js";
import type { ShipwrightConfig } from "../config.js";

export function writeProgress(config: ShipwrightConfig, state: PipelineState): void {
  const filePath = resolve(config.target.dir, config.tracking.progressFile);

  const lines: string[] = [
    `# Build Progress: ${extractTitle(state.prdPath)}`,
    "",
    `**PRD**: ${state.prdPath}`,
    `**Started**: ${state.startedAt}`,
    `**Status**: ${state.phase.toUpperCase()}`,
    `**Cost**: $${state.totalCostUsd.toFixed(4)}`,
    `**Updated**: ${timestamp()}`,
    "",
    "---",
    "",
    "## Sprints",
    "",
  ];

  for (let i = 0; i < state.sprints.length; i++) {
    const sprint = state.sprints[i];
    const emoji = statusEmoji(sprint.status);
    lines.push(`### Sprint ${i + 1}: ${sprint.plan.title} ${emoji}`);
    lines.push(`- **Status**: ${sprint.status.toUpperCase()}`);

    if (sprint.attempts.length > 0) {
      const lastAttempt = sprint.attempts[sprint.attempts.length - 1];
      lines.push(`- **Attempts**: ${sprint.attempts.length}`);
      lines.push(`- **Score**: ${lastAttempt.evalResult.overallScore}/10`);
      lines.push(`- **Files changed**: ${lastAttempt.filesChanged.length}`);
      lines.push(`- **Duration**: ${formatDuration(sprint.durationMs)}`);
      lines.push(`- **Cost**: $${sprint.costUsd.toFixed(4)}`);

      if (sprint.commitHash) {
        lines.push(`- **Commit**: ${sprint.commitHash}`);
      }

      if (!lastAttempt.evalResult.passed && lastAttempt.evalResult.failureReasons.length > 0) {
        lines.push(`- **Failures**: ${lastAttempt.evalResult.failureReasons.join("; ")}`);
      }
    } else {
      lines.push(`- **Attempts**: 0`);
    }

    lines.push("");
  }

  writeText(filePath, lines.join("\n"));
}

function extractTitle(prdPath: string): string {
  try {
    if (fileExists(prdPath)) {
      const content = readText(prdPath);
      const titleMatch = content.match(/^#\s+(.+)/m);
      if (titleMatch) return titleMatch[1].replace(/^PRD:\s*/i, "").trim();
    }
  } catch {}
  return prdPath.split("/").pop()?.replace(/\.md$/, "") ?? "Unknown";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}
