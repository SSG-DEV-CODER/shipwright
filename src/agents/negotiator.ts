/**
 * Negotiator Agent — mediates contract between Planner and Evaluator
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintContract, NegotiationRound } from "../pipeline/types.js";
import type { PlannerOutput } from "./planner.js";
import type { AcceptanceCriterion } from "../intake/types.js";

const NEGOTIATOR_ROLE: AgentRole = "negotiator";

interface NegotiationResult {
  outcome: "accepted" | "counter" | "rejected";
  contract: {
    acceptanceCriteria: AcceptanceCriterion[];
    implementation: SprintContract["implementation"];
    evaluationCriteria: SprintContract["evaluationCriteria"];
    reasoning: string;
  };
}

/**
 * Run contract negotiation between planner output and evaluator requirements.
 * Returns a finalized, signed contract.
 */
export async function negotiateContract(
  config: ShipwrightConfig,
  sprintId: string,
  title: string,
  plannerOutput: PlannerOutput,
  acceptanceCriteria: AcceptanceCriterion[],
  maxRounds: number = 2
): Promise<SprintContract> {
  const systemPrompt = loadPromptFile("negotiator.md");
  const rounds: NegotiationRound[] = [];

  // Build initial contract from planner
  let currentContract: SprintContract = {
    sprintId,
    title,
    acceptanceCriteria,
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
    evaluationCriteria: (plannerOutput.evaluationCriteria ?? []).map((ec, idx) => ({
      id: `eval-${String(idx + 1).padStart(3, "0")}`,
      criterion: ec.criterion,
      weight: 1 / ((plannerOutput.evaluationCriteria ?? []).length || 1),
      specificChecks: ec.specificChecks ?? [],
    })),
    negotiationRounds: [],
  };

  // Negotiation rounds
  for (let round = 1; round <= maxRounds; round++) {
    const userPrompt = [
      `## Contract Negotiation Round ${round}/${maxRounds}`,
      "",
      `## Sprint: ${title}`,
      "",
      "## Current Contract",
      "",
      "**Acceptance Criteria (immutable — from PRD):**",
      ...acceptanceCriteria.map((c) => `- [${c.id}] ${c.text}`),
      "",
      "**Implementation Steps (from Planner):**",
      ...currentContract.implementation.steps.map(
        (s) => `${s.order}. ${s.description}${(s.targetFiles?.length ?? 0) > 0 ? ` → ${s.targetFiles.join(", ")}` : ""}`
      ),
      "",
      "**Evaluation Criteria (from Planner):**",
      ...currentContract.evaluationCriteria.map(
        (ec) => `- ${ec.criterion}: ${ec.specificChecks.join("; ")}`
      ),
      "",
      "**Validation Commands:**",
      ...currentContract.implementation.validationCommands.map((c) => `- \`${c}\``),
      "",
      "Review this contract. Are the criteria specific and testable? Are edge cases covered?",
      "Produce JSON with: outcome (accepted/counter), contract (with any tightened criteria), reasoning.",
    ].join("\n");

    const result = await runAgent({
      role: NEGOTIATOR_ROLE,
      systemPrompt,
      userPrompt,
      tools: AGENT_TOOLS[NEGOTIATOR_ROLE],
      model: config.models.negotiator,
      maxTurns: 10,
    });

    const negotiation = extractJson<NegotiationResult>(
      result.output,
      ["outcome", "contract"],
      { outcome: "accepted", contract: { acceptanceCriteria, implementation: currentContract.implementation, evaluationCriteria: currentContract.evaluationCriteria, reasoning: "Auto-accepted" } }
    );

    rounds.push({
      round,
      proposerRole: "negotiator",
      proposedChanges: negotiation.contract.reasoning,
      outcome: negotiation.outcome,
      reasoning: negotiation.contract.reasoning,
    });

    if (negotiation.outcome === "accepted") {
      break;
    }

    // Apply negotiator's tightened criteria
    if (negotiation.contract.evaluationCriteria) {
      currentContract.evaluationCriteria = negotiation.contract.evaluationCriteria;
    }
  }

  // Sign the contract
  currentContract.negotiationRounds = rounds;
  currentContract.signedAt = new Date().toISOString();

  return currentContract;
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a contract negotiator. Ensure criteria are specific and testable.`;
  }
}
