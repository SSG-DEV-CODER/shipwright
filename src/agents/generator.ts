/**
 * Generator Agent — implements code according to a sprint contract
 *
 * Key insight from adversarial-dev: the harness does NOT parse the generator's
 * output. It just lets the generator run and the evaluator independently
 * inspects what was built. We follow the same pattern.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintContract, EvalResult } from "../pipeline/types.js";

const GENERATOR_ROLE: AgentRole = "generator";

/**
 * Run the generator agent. Returns the raw text response (not parsed).
 * The harness does NOT use the return value for file tracking —
 * the evaluator independently discovers what was built.
 */
export async function runGenerator(
  config: ShipwrightConfig,
  contract: SprintContract,
  prdText: string,
  scoutReports: string,
  expertiseContext: string,
  previousFeedback?: EvalResult
): Promise<string> {
  const systemPrompt = loadPromptFile("generator.md");

  // Build the user prompt — following adversarial-dev's pattern:
  // Full spec + contract + optional feedback
  const parts: string[] = [
    `IMPORTANT: Your working directory is ${resolve(config.target.dir)}. Create all files inside this directory.`,
    "",
    "## Product Spec (PRD)",
    "",
    prdText,
    "",
    "## Sprint Implementation Plan",
    "",
    `### Sprint: ${contract.title}`,
    "",
  ];

  // Add concrete implementation steps
  if (contract.implementation.steps.length > 0) {
    parts.push("### Steps (implement in order, top to bottom):");
    for (const step of contract.implementation.steps) {
      parts.push(`${step.order}. ${step.description}`);
      if ((step.targetFiles ?? []).length > 0) {
        for (const f of step.targetFiles) {
          parts.push(`   - File: ${f}`);
        }
      }
    }
    parts.push("");
  }

  // Add file lists
  if ((contract.implementation.filesToCreate ?? []).length > 0) {
    parts.push("### Files to Create:");
    for (const f of contract.implementation.filesToCreate) {
      parts.push(`- ${f}`);
    }
    parts.push("");
  }

  if ((contract.implementation.filesToModify ?? []).length > 0) {
    parts.push("### Files to Modify:");
    for (const f of contract.implementation.filesToModify) {
      parts.push(`- ${f}`);
    }
    parts.push("");
  }

  // Add acceptance criteria
  if (contract.acceptanceCriteria.length > 0) {
    parts.push("### Acceptance Criteria (evaluator will check these):");
    for (const ac of contract.acceptanceCriteria) {
      parts.push(`- [${ac.id}] ${ac.text}`);
    }
    parts.push("");
  }

  // Add validation commands
  if ((contract.implementation.validationCommands ?? []).length > 0) {
    parts.push("### Validation Commands (run AFTER implementing all files):");
    for (const cmd of contract.implementation.validationCommands) {
      parts.push(`- \`${cmd}\``);
    }
    parts.push("");
  }

  // Add scout reports and expertise as context
  if (scoutReports) {
    parts.push(scoutReports);
  }
  if (expertiseContext) {
    parts.push(expertiseContext);
  }

  // Add retry feedback
  if (previousFeedback) {
    parts.push(
      "",
      "## EVALUATION FEEDBACK (MUST ADDRESS EVERY ISSUE)",
      "",
      `Previous attempt scored ${previousFeedback.overallScore}/10 and FAILED.`,
      "",
      previousFeedback.feedback,
      "",
    );
    if ((previousFeedback.failureReasons ?? []).length > 0) {
      parts.push("### Specific Failures:");
      for (const reason of previousFeedback.failureReasons) {
        parts.push(`- ${reason}`);
      }
    }
    for (const score of (previousFeedback.scores ?? []).filter((s) => s.score < 7)) {
      parts.push(`\n[${score.criterionId}] ${score.criterion}: ${score.score}/10 — ${score.reasoning}`);
      for (const failure of score.specificFailures ?? []) {
        parts.push(`  - ${failure}`);
      }
    }
    parts.push("", "Address every issue above. The evaluator will re-check all criteria.");
  } else {
    parts.push("", "Implement the features listed above. Work through the steps in order, top to bottom. Do not stop until every step is complete.");
  }

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

  return result.output;
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a software engineer. Implement the sprint plan top to bottom.`;
  }
}
