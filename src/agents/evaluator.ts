/**
 * Evaluator Agent — adversarial code review
 *
 * Routes to Claude or Codex automatically based on config.models.evaluator.
 * The unified runAgent() handles SDK selection internally.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import { extractEvalFromText } from "../lib/text-to-eval.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintContract, EvalResult } from "../pipeline/types.js";

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

  if ((contract.evaluationCriteria ?? []).length > 0) {
    parts.push("", `## Additional Evaluation Criteria`);
    for (const ec of contract.evaluationCriteria ?? []) {
      parts.push(`- [${ec.id}] ${ec.criterion ?? "unknown"} (weight: ${ec.weight ?? 1})`);
      for (const check of ec.specificChecks ?? []) {
        parts.push(`  - ${check}`);
      }
    }
  }

  parts.push("", `## Validation Commands to Run`);
  for (const cmd of contract.implementation.validationCommands ?? []) {
    parts.push(`- \`${cmd}\``);
  }

  parts.push("", `## Files Changed by Generator`);
  if (filesChanged.length > 0) {
    for (const f of filesChanged) {
      parts.push(`- ${f}`);
    }
  } else {
    parts.push("- (explore the working directory to see what was built)");
  }

  parts.push(
    "",
    "## Your Task",
    "",
    "Phase 1 — Investigate (max 20 tool calls):",
    "1. List files in the working directory to see what was built",
    "2. Read the key source files critically",
    "3. Run ALL validation commands listed above",
    "4. Check each acceptance criterion",
    "",
    "Phase 2 — Verdict (MANDATORY):",
    "After investigation, output your evaluation.",
    "Score each acceptance criterion 1-10. Be SKEPTICAL. Do NOT be generous.",
  );

  // Single call — runAgent() routes to Claude or Codex based on model string
  const schemaPath = resolve(import.meta.dir, "../schemas/eval-result.json");
  const result = await runAgent({
    role: EVALUATOR_ROLE,
    systemPrompt,
    userPrompt: parts.join("\n"),
    tools: AGENT_TOOLS[EVALUATOR_ROLE],
    model: config.models.evaluator,
    maxTurns: 40,
    workingDir: config.target.dir,
    outputSchema: schemaPath, // Used by Codex for guaranteed JSON; ignored by Claude
  });

  // --- Three-strategy extraction ---
  const rawOutput = result.output;

  // Strategy 1: JSON extraction
  const jsonResult = extractJson<EvalResult>(
    rawOutput,
    ["passed", "overallScore", "scores"],
    null as unknown as EvalResult
  );

  if (jsonResult && Array.isArray(jsonResult.scores) && jsonResult.scores.length > 0) {
    return coerceEvalResult(jsonResult, rawOutput, config.pipeline.evalPassThreshold);
  }

  // Strategy 2: Text-to-eval extraction
  const textResult = extractEvalFromText(
    rawOutput,
    contract.acceptanceCriteria,
    config.pipeline.evalPassThreshold
  );

  if (textResult && textResult.scores.some((s) => s.score > 0)) {
    console.warn("[evaluator] Using text-extracted evaluation (no clean JSON found)");
    return textResult;
  }

  // Strategy 3: Fallback defaults with raw feedback
  console.warn("[evaluator] Could not extract evaluation from agent output. Using defaults.");
  return buildDefaultEvalResult(contract, rawOutput);
}

function coerceEvalResult(raw: EvalResult, rawText: string, threshold: number): EvalResult {
  const rawAny = raw as unknown as Record<string, unknown>;
  const rawScores = Array.isArray(raw.scores) ? raw.scores : [];

  const scores = rawScores.map((s) => {
    const sa = s as unknown as Record<string, unknown>;
    return {
      criterionId: String(sa.criterionId ?? sa.criterion_id ?? "unknown"),
      criterion: String(sa.criterion ?? ""),
      score: typeof sa.score === "number" ? sa.score : 0,
      reasoning: String(sa.reasoning ?? ""),
      specificFailures: Array.isArray(sa.specificFailures)
        ? sa.specificFailures as string[]
        : Array.isArray(sa.specific_failures)
          ? sa.specific_failures as string[]
          : [],
    };
  });

  const overallScore = typeof raw.overallScore === "number"
    ? raw.overallScore
    : typeof rawAny.overall_score === "number"
      ? rawAny.overall_score as number
      : scores.length > 0
        ? Math.round((scores.reduce((sum, s) => sum + s.score, 0) / scores.length) * 10) / 10
        : 0;

  const passed = overallScore >= threshold &&
    (scores.length === 0 || scores.every((s) => s.score >= threshold));

  return {
    passed,
    overallScore,
    scores,
    feedback: typeof raw.feedback === "string" ? raw.feedback : rawText.slice(0, 2000),
    failureReasons: Array.isArray(raw.failureReasons)
      ? raw.failureReasons
      : Array.isArray(rawAny.failure_reasons)
        ? rawAny.failure_reasons as string[]
        : passed ? [] : ["See feedback for details"],
  };
}

function buildDefaultEvalResult(contract: SprintContract, agentOutput: string): EvalResult {
  return {
    passed: false,
    overallScore: 0,
    scores: (contract.acceptanceCriteria ?? []).map((ac) => ({
      criterionId: ac.id,
      criterion: ac.text,
      score: 0,
      reasoning: "Evaluation failed to produce structured scores",
      specificFailures: [],
    })),
    feedback: agentOutput.slice(0, 3000) || "Evaluation agent did not produce parseable results.",
    failureReasons: ["Evaluation output could not be parsed into structured scores"],
  };
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are an adversarial evaluator. Find flaws. Do not praise. End with JSON evaluation.`;
  }
}
