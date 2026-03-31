/**
 * Evaluator Agent — adversarial code review using Codex
 * Tries to BREAK what the Generator built. Does NOT praise work.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintContract, EvalResult, EvalScore } from "../pipeline/types.js";

const EVALUATOR_ROLE: AgentRole = "evaluator";

export async function runEvaluator(
  config: ShipwrightConfig,
  contract: SprintContract,
  filesChanged: string[]
): Promise<EvalResult> {
  const systemPrompt = loadPromptFile("evaluator.md");

  const parts: string[] = [
    `## Sprint Contract: ${contract.title}`,
    "",
    `## Acceptance Criteria (ALL must score 7+/10 to pass)`,
  ];

  for (const ac of contract.acceptanceCriteria) {
    parts.push(`- [${ac.id}] ${ac.text}`);
  }

  if (contract.evaluationCriteria.length > 0) {
    parts.push("", `## Additional Evaluation Criteria`);
    for (const ec of contract.evaluationCriteria) {
      parts.push(`- [${ec.id}] ${ec.criterion} (weight: ${ec.weight})`);
      for (const check of ec.specificChecks) {
        parts.push(`  - ${check}`);
      }
    }
  }

  parts.push(
    "",
    `## Validation Commands to Run`,
  );
  for (const cmd of contract.implementation.validationCommands) {
    parts.push(`- \`${cmd}\``);
  }

  parts.push(
    "",
    `## Files Changed by Generator`,
  );
  for (const f of filesChanged) {
    parts.push(`- ${f}`);
  }

  parts.push(
    "",
    "## Your Task",
    "",
    "1. Read the changed files critically",
    "2. Run ALL validation commands",
    "3. Test edge cases — empty inputs, missing data, error paths",
    "4. Score each acceptance criterion 1-10",
    "5. Be SKEPTICAL. Do NOT be generous.",
    "6. Kill any background processes BEFORE producing output",
    "",
    "Produce your evaluation as JSON with: passed, overallScore, scores, feedback, failureReasons",
  );

  const result = await runAgent({
    role: EVALUATOR_ROLE,
    systemPrompt,
    userPrompt: parts.join("\n"),
    tools: AGENT_TOOLS[EVALUATOR_ROLE],
    model: config.models.evaluator,
    maxTurns: 30,
    workingDir: config.target.dir,
  });

  const evalResult = extractJson<EvalResult>(
    result.output,
    ["passed", "overallScore", "scores"],
    buildDefaultEvalResult(contract)
  );

  // Enforce pass threshold
  const threshold = config.pipeline.evalPassThreshold;
  evalResult.passed = evalResult.overallScore >= threshold &&
    evalResult.scores.every((s) => s.score >= threshold);

  return evalResult;
}

function buildDefaultEvalResult(contract: SprintContract): EvalResult {
  return {
    passed: false,
    overallScore: 0,
    scores: contract.acceptanceCriteria.map((ac) => ({
      criterionId: ac.id,
      criterion: ac.text,
      score: 0,
      reasoning: "Evaluation failed to produce results",
      specificFailures: [],
    })),
    feedback: "Evaluation agent did not produce parseable results.",
    failureReasons: ["Evaluation output could not be parsed"],
  };
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are an adversarial evaluator. Find flaws. Do not praise.`;
  }
}
