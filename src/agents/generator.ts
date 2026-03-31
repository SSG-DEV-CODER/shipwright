/**
 * Generator Agent — implements code according to a sprint contract
 * This is the ONLY agent that can create and modify files.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintContract, EvalResult } from "../pipeline/types.js";

const GENERATOR_ROLE: AgentRole = "generator";

export interface GeneratorOutput {
  filesCreated: string[];
  filesModified: string[];
  approach: string;
  decisions: string[];
  knownLimitations: string[];
}

export async function runGenerator(
  config: ShipwrightConfig,
  contract: SprintContract,
  scoutReports: string,
  expertiseContext: string,
  previousFeedback?: EvalResult
): Promise<GeneratorOutput> {
  const systemPrompt = loadPromptFile("generator.md");
  const attempt = previousFeedback ? "RETRY" : "INITIAL";

  const parts: string[] = [
    `## Sprint Contract: ${contract.title}`,
    "",
    `## Implementation Steps`,
  ];

  for (const step of contract.implementation.steps) {
    parts.push(`${step.order}. ${step.description}`);
    if ((step.targetFiles ?? []).length > 0) {
      parts.push(`   Files: ${step.targetFiles.join(", ")}`);
    }
  }

  parts.push(
    "",
    `## Files to Create: ${(contract.implementation.filesToCreate ?? []).join(", ") || "none"}`,
    `## Files to Modify: ${(contract.implementation.filesToModify ?? []).join(", ") || "none"}`,
    "",
    `## Acceptance Criteria`,
  );

  for (const ac of contract.acceptanceCriteria) {
    parts.push(`- [${ac.id}] ${ac.text}`);
  }

  parts.push(
    "",
    `## Validation Commands`,
  );
  for (const cmd of contract.implementation.validationCommands) {
    parts.push(`- \`${cmd}\``);
  }

  if ((contract.evaluationCriteria ?? []).length > 0) {
    parts.push("", `## Evaluator Will Check`);
    for (const ec of contract.evaluationCriteria ?? []) {
      parts.push(`- ${ec.criterion ?? "unknown criterion"}`);
      for (const check of ec.specificChecks ?? []) {
        parts.push(`  - ${check}`);
      }
    }
  }

  // Add scout reports and expertise
  if (scoutReports) {
    parts.push("", scoutReports);
  }
  if (expertiseContext) {
    parts.push("", expertiseContext);
  }

  // Add retry feedback
  if (previousFeedback) {
    parts.push(
      "",
      `## RETRY — Previous Evaluation Failed (score: ${previousFeedback.overallScore}/10)`,
      "",
      "**You MUST address ALL of these issues:**",
      "",
      previousFeedback.feedback,
      "",
      "**Specific failures:**",
    );
    for (const reason of previousFeedback.failureReasons) {
      parts.push(`- ${reason}`);
    }
    for (const score of (previousFeedback.scores ?? []).filter((s) => s.score < 7)) {
      parts.push(`- [${score.criterionId}] ${score.criterion}: ${score.score}/10 — ${score.reasoning}`);
      for (const failure of score.specificFailures) {
        parts.push(`  - ${failure}`);
      }
    }
  }

  parts.push(
    "",
    `## Mode: ${attempt}`,
    "",
    "Implement the sprint. Make atomic commits. Produce a summary JSON with: filesCreated, filesModified, approach, decisions, knownLimitations.",
  );

  const result = await runAgent({
    role: GENERATOR_ROLE,
    systemPrompt,
    userPrompt: parts.join("\n"),
    tools: AGENT_TOOLS[GENERATOR_ROLE],
    model: config.models.generator,
    maxTurns: 50,
    workingDir: config.target.dir,
    persistSession: true,
  });

  const parsed = extractJson<GeneratorOutput>(
    result.output,
    ["filesCreated", "approach"],
    {
      filesCreated: [],
      filesModified: [],
      approach: result.output.slice(0, 500),
      decisions: [],
      knownLimitations: [],
    }
  );

  return {
    filesCreated: Array.isArray(parsed.filesCreated) ? parsed.filesCreated : [],
    filesModified: Array.isArray(parsed.filesModified) ? parsed.filesModified : [],
    approach: typeof parsed.approach === "string" ? parsed.approach : result.output.slice(0, 500),
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    knownLimitations: Array.isArray(parsed.knownLimitations) ? parsed.knownLimitations : [],
  };
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a generator agent. Implement the sprint contract.`;
  }
}
