/**
 * Evaluator Agent — adversarial code review
 * Tries to BREAK what the Generator built. Does NOT praise work.
 *
 * Uses Codex CLI when model is "codex" (true adversarial tension — different
 * model than the generator). Falls back to Claude Code SDK for Claude models.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { isCodexAvailable, runCodex } from "./codex-runner.js";
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
    parts.push("- (generator did not report specific files — explore the working directory)");
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
    "After investigation, you MUST output a JSON code block as the LAST thing in your response.",
    "Score each acceptance criterion 1-10. Be SKEPTICAL. Do NOT be generous.",
    "",
    "REMINDER: Your response MUST end with a ```json code block containing the evaluation.",
    "Do NOT use any more tools after outputting the JSON.",
  );

  const userPrompt = parts.join("\n");
  let rawOutput: string = "";

  // Route to Codex or Claude based on model config
  const isCodexModel = config.models.evaluator.toLowerCase().includes("codex");

  if (isCodexModel && await isCodexAvailable()) {
    console.log("[evaluator] Using Codex CLI (adversarial — different model than generator)");
    const schemaPath = resolve(import.meta.dir, "../schemas/eval-result.json");
    const codexResult = await runCodex({
      systemPrompt,
      userPrompt,
      workingDir: config.target.dir,
      outputSchema: schemaPath,
    });
    rawOutput = codexResult.output;
  } else {
    if (isCodexModel) {
      console.warn("[evaluator] Codex CLI not available, falling back to Claude");
    }
    const result = await runAgent({
      role: EVALUATOR_ROLE,
      systemPrompt,
      userPrompt,
      tools: AGENT_TOOLS[EVALUATOR_ROLE],
      model: config.models.evaluator,
      maxTurns: 40,
      workingDir: config.target.dir,
    });
    rawOutput = rawOutput;
  }

  // --- Three-strategy output extraction ---

  // Strategy 1: Try JSON extraction (best case — agent produced clean JSON)
  const jsonResult = extractJson<EvalResult>(
    rawOutput,
    ["passed", "overallScore", "scores"],
    null as unknown as EvalResult // intentionally null to detect failure
  );

  if (jsonResult && Array.isArray(jsonResult.scores) && jsonResult.scores.length > 0) {
    return coerceEvalResult(jsonResult, rawOutput, config.pipeline.evalPassThreshold);
  }

  // Strategy 2: Try text-to-eval extraction (agent wrote text, not JSON)
  const textResult = extractEvalFromText(
    rawOutput,
    contract.acceptanceCriteria,
    config.pipeline.evalPassThreshold
  );

  if (textResult && textResult.scores.some((s) => s.score > 0)) {
    console.warn("[evaluator] Using text-extracted evaluation (no clean JSON found)");
    return textResult;
  }

  // Strategy 3: Fallback — agent produced nothing parseable
  console.warn("[evaluator] Could not extract evaluation from agent output. Using defaults.");
  return buildDefaultEvalResult(contract, rawOutput);
}

/**
 * Coerce a raw JSON extraction into a valid EvalResult with proper types.
 */
function coerceEvalResult(
  raw: EvalResult,
  rawText: string,
  threshold: number
): EvalResult {
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
    feedback: typeof raw.feedback === "string"
      ? raw.feedback
      : rawText.slice(0, 2000),
    failureReasons: Array.isArray(raw.failureReasons)
      ? raw.failureReasons
      : Array.isArray(rawAny.failure_reasons)
        ? rawAny.failure_reasons as string[]
        : passed ? [] : ["See feedback for details"],
  };
}

function buildDefaultEvalResult(contract: SprintContract, agentOutput: string): EvalResult {
  // Even if we can't parse structured output, provide the raw feedback
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
