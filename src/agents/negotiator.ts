/**
 * Negotiator Agent — reviews and tightens the plan before the generator builds
 *
 * With the plan-to-file pattern, the negotiator reads the plan file,
 * checks that criteria are specific and testable, and optionally
 * appends tightened evaluation criteria to the plan.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { fileExists, readText } from "../lib/fs.js";
import type { ShipwrightConfig } from "../config.js";
import type { AcceptanceCriterion } from "../intake/types.js";

const NEGOTIATOR_ROLE: AgentRole = "negotiator";

/**
 * Review and tighten the sprint plan.
 * Reads the plan file, checks quality, optionally appends criteria.
 * Returns the negotiator's assessment text.
 */
export async function negotiateContract(
  config: ShipwrightConfig,
  planFilePath: string,
  acceptanceCriteria: AcceptanceCriterion[]
): Promise<string> {
  const systemPrompt = loadPromptFile("negotiator.md");

  const parts: string[] = [
    `## Task`,
    `Review the sprint plan at: ${planFilePath}`,
    "",
    `## Acceptance Criteria (immutable — from PRD):`,
    ...acceptanceCriteria.map((c) => `- [${c.id}] ${c.text}`),
    "",
    "Read the plan file. Check that:",
    "1. Every step has exact file paths",
    "2. Steps are small and atomic (1-5 files each)",
    "3. Steps are ordered by dependency",
    "4. Validation commands are included",
    "5. Acceptance criteria are covered by the steps",
    "",
    "If the plan is good, say ACCEPTED.",
    "If it needs tightening, append additional evaluation criteria to the plan file.",
  ];

  const result = await runAgent({
    role: NEGOTIATOR_ROLE,
    systemPrompt,
    userPrompt: parts.join("\n"),
    tools: AGENT_TOOLS[NEGOTIATOR_ROLE],
    model: config.models.negotiator,
    maxTurns: 10,
    workingDir: config.target.dir,
    mcpServers: config.mcpServers,
  });

  return result.output;
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a contract negotiator. Review the plan and ensure criteria are specific and testable.`;
  }
}
