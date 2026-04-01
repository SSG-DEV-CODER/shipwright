/**
 * PRD Validator Agent — checks PRD against vendor documentation before building.
 *
 * Uses Context7 MCP + agent-browser MCP to fetch real vendor docs and compare
 * against the PRD's instructions. Flags contradictions, impossibilities, and
 * ambiguities BEFORE any tokens are spent on building.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import type { ShipwrightConfig } from "../config.js";

const VALIDATOR_ROLE: AgentRole = "validator";

export interface ValidationIssue {
  severity: "critical" | "warning" | "info";
  step: string;
  technology: string;
  prdSays: string;
  vendorSays: string;
  problem: string;
  fix: string;
  docSource: string;
}

export interface ValidationResult {
  prdTitle: string;
  technologies: string[];
  issues: ValidationIssue[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    verdict: "PASS" | "REVIEW" | "BLOCK";
  };
}

export async function runValidator(
  config: ShipwrightConfig,
  prdPath: string,
): Promise<ValidationResult> {
  const systemPrompt = readFileSync(
    resolve(import.meta.dir, "../prompts/validator.md"),
    "utf-8",
  );

  const prdContent = readFileSync(resolve(prdPath), "utf-8");

  const userPrompt = [
    `## PRD to Validate`,
    ``,
    `File: ${prdPath}`,
    ``,
    `\`\`\`markdown`,
    prdContent,
    `\`\`\``,
    ``,
    `## Instructions`,
    ``,
    `1. Read the full PRD above carefully.`,
    `2. Identify every technology, library, framework, and tool mentioned.`,
    `3. For EACH technology, use Context7 MCP to fetch the official documentation.`,
    `4. Compare the PRD's instructions against the vendor's recommended approach.`,
    `5. Flag every contradiction, impossibility, and ambiguity you find.`,
    `6. Output your findings as the structured JSON described in your system prompt.`,
    ``,
    `Be thorough. Every issue you catch now saves hours of failed builds.`,
  ].join("\n");

  const result = await runAgent({
    role: VALIDATOR_ROLE,
    systemPrompt,
    userPrompt,
    tools: AGENT_TOOLS[VALIDATOR_ROLE],
    model: config.models.planner, // Use the same model as the planner (Opus)
    maxTurns: 50, // Needs room to fetch multiple vendor docs
    workingDir: config.target.dir,
    mcpServers: config.mcpServers,
  });

  // Extract structured result
  const fallback: ValidationResult = {
    prdTitle: "Unknown",
    technologies: [],
    issues: [],
    summary: { critical: 0, warning: 0, info: 0, verdict: "REVIEW" },
  };

  const parsed = extractJson<ValidationResult>(
    result.output,
    ["prdTitle", "issues", "summary"],
    fallback,
  );

  if (parsed && parsed.summary && parsed.issues) {
    return parsed;
  }

  // Fallback: try to extract from output even if JSON extraction failed
  console.warn("[validator] Could not extract structured validation result. Returning raw output.");
  return {
    prdTitle: "Unknown",
    technologies: [],
    issues: [{
      severity: "warning",
      step: "N/A",
      technology: "N/A",
      prdSays: "N/A",
      vendorSays: "N/A",
      problem: "Validator output could not be parsed as structured JSON",
      fix: "Review raw output manually",
      docSource: "N/A",
    }],
    summary: {
      critical: 0,
      warning: 1,
      info: 0,
      verdict: "REVIEW",
    },
  };
}

/**
 * Format validation result for terminal output.
 */
export function formatValidationReport(result: ValidationResult): string {
  const lines: string[] = [
    ``,
    `⚓ PRD Validation Report: ${result.prdTitle}`,
    `${"═".repeat(60)}`,
    ``,
    `Technologies: ${result.technologies.join(", ")}`,
    ``,
  ];

  if (result.issues.length === 0) {
    lines.push(`  No issues found.`);
  }

  // Group by severity
  const criticals = result.issues.filter((i) => i.severity === "critical");
  const warnings = result.issues.filter((i) => i.severity === "warning");
  const infos = result.issues.filter((i) => i.severity === "info");

  if (criticals.length > 0) {
    lines.push(`🔴 CRITICAL (${criticals.length}) — Will fail:`);
    for (const issue of criticals) {
      lines.push(`  [${issue.step}] ${issue.technology}`);
      lines.push(`    PRD says: ${issue.prdSays}`);
      lines.push(`    Vendor says: ${issue.vendorSays}`);
      lines.push(`    Problem: ${issue.problem}`);
      lines.push(`    Fix: ${issue.fix}`);
      lines.push(`    Source: ${issue.docSource}`);
      lines.push(``);
    }
  }

  if (warnings.length > 0) {
    lines.push(`🟡 WARNING (${warnings.length}) — Likely problems:`);
    for (const issue of warnings) {
      lines.push(`  [${issue.step}] ${issue.technology}`);
      lines.push(`    Problem: ${issue.problem}`);
      lines.push(`    Fix: ${issue.fix}`);
      lines.push(``);
    }
  }

  if (infos.length > 0) {
    lines.push(`🔵 INFO (${infos.length}) — Suggestions:`);
    for (const issue of infos) {
      lines.push(`  [${issue.step}] ${issue.problem}`);
      lines.push(`    Fix: ${issue.fix}`);
      lines.push(``);
    }
  }

  lines.push(`${"═".repeat(60)}`);
  lines.push(`Verdict: ${result.summary.verdict} (${result.summary.critical} critical, ${result.summary.warning} warnings, ${result.summary.info} info)`);

  if (result.summary.verdict === "BLOCK") {
    lines.push(`\n  🛑 BUILD BLOCKED — Fix critical issues before running Shipwright.`);
  } else if (result.summary.verdict === "REVIEW") {
    lines.push(`\n  ⚠️  REVIEW REQUIRED — Human should check warnings before building.`);
  } else {
    lines.push(`\n  ✅ PRD looks good. Safe to build.`);
  }

  lines.push(``);
  return lines.join("\n");
}
