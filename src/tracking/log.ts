/**
 * LOG.md auto-writer — appends timestamped entries for every pipeline event
 */

import { resolve } from "path";
import { writeText, fileExists, readText } from "../lib/fs.js";
import { timestamp } from "../lib/markdown.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintContract, EvalResult, ScoutReport } from "../pipeline/types.js";

export class BuildLog {
  private entries: string[] = [];
  private config: ShipwrightConfig;
  private prdTitle: string;

  constructor(config: ShipwrightConfig, prdPath: string) {
    this.config = config;
    this.prdTitle = extractTitle(prdPath);

    // Initialize with header
    this.entries.push(
      `# Build Log: ${this.prdTitle}`,
      "",
      `**PRD**: ${prdPath}`,
      `**Started**: ${timestamp()}`,
      "",
      "---",
      "",
    );
  }

  logSprintStart(sprintNum: number, title: string): void {
    this.entries.push(`## Sprint ${sprintNum}: ${title}`, "");
  }

  logScoutReports(reports: ScoutReport[]): void {
    this.entries.push(`### Scout Report (${timestamp()})`, "");
    for (const r of reports) {
      this.entries.push(`- **${r.focus}** (${r.durationMs}ms)`);
      this.entries.push(`  - Files found: ${r.findings.relevantFiles.length}`);
      if (r.findings.patterns.length > 0) {
        this.entries.push(`  - Patterns: ${r.findings.patterns.slice(0, 3).join("; ")}`);
      }
      if (r.findings.potentialIssues.length > 0) {
        this.entries.push(`  - Issues: ${r.findings.potentialIssues.join("; ")}`);
      }
    }
    this.entries.push("");
  }

  logContract(contract: SprintContract): void {
    this.entries.push(`### Contract (${timestamp()})`, "");
    this.entries.push("**Acceptance criteria:**");
    for (const ac of contract.acceptanceCriteria) {
      this.entries.push(`- [${ac.id}] ${ac.text}`);
    }
    this.entries.push("");

    this.entries.push("**Implementation steps:**");
    for (const step of contract.implementation.steps) {
      this.entries.push(`${step.order}. ${step.description}`);
    }
    this.entries.push("");

    if (contract.evaluationCriteria.length > 0) {
      this.entries.push("**Evaluation criteria:**");
      for (const ec of contract.evaluationCriteria) {
        this.entries.push(`- ${ec.criterion}`);
      }
      this.entries.push("");
    }

    this.entries.push(`**Signed at**: ${contract.signedAt}`, "");
  }

  logBuildAttempt(attempt: number, evalResult: EvalResult): void {
    const emoji = evalResult.passed ? "✅" : "❌";
    this.entries.push(
      `### Build Attempt ${attempt} (${timestamp()}) ${emoji}`,
      "",
      `- **Score**: ${evalResult.overallScore}/10`,
      `- **Passed**: ${evalResult.passed}`,
    );

    for (const score of evalResult.scores) {
      const icon = score.score >= 7 ? "✅" : "❌";
      this.entries.push(`- ${icon} [${score.criterionId}] ${score.criterion}: ${score.score}/10`);
      if (score.specificFailures.length > 0) {
        for (const failure of score.specificFailures) {
          this.entries.push(`  - ${failure}`);
        }
      }
    }

    if (!evalResult.passed) {
      this.entries.push("", "**Feedback:**", evalResult.feedback);
    }

    this.entries.push("");
  }

  logExpertiseUpdate(domain: string, changes: string[]): void {
    this.entries.push(`### Expertise Update (${timestamp()})`, "");
    this.entries.push(`- **Domain**: ${domain}`);
    for (const change of changes) {
      this.entries.push(`- ${change}`);
    }
    this.entries.push("");
  }

  logCommit(hash: string): void {
    this.entries.push(`### Commit: ${hash}`, "");
  }

  logSprintComplete(sprintNum: number, status: string, score: number, durationMs: number): void {
    const emoji = status === "passed" ? "✅" : "❌";
    this.entries.push(
      `### Sprint ${sprintNum} Result: ${status.toUpperCase()} ${emoji}`,
      `- Score: ${score}/10`,
      `- Duration: ${(durationMs / 1000).toFixed(1)}s`,
      "",
      "---",
      "",
    );
  }

  logPipelineComplete(status: string, totalDurationMs: number, totalCostUsd: number): void {
    this.entries.push(
      `## Pipeline Complete: ${status.toUpperCase()}`,
      "",
      `- Duration: ${(totalDurationMs / 1000).toFixed(1)}s`,
      `- Cost: $${totalCostUsd.toFixed(4)}`,
      `- Finished: ${timestamp()}`,
    );
  }

  /** Write the full log to disk */
  flush(): void {
    const filePath = resolve(this.config.target.dir, this.config.tracking.logFile);
    writeText(filePath, this.entries.join("\n") + "\n");
  }
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
