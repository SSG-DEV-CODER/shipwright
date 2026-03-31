/**
 * Planner Agent — produces a sprint plan FILE from PRD + expertise + scout reports
 *
 * The planner writes a markdown plan file to disk. The generator then reads
 * this file and implements it top to bottom (agent-experts pattern).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintPlan } from "../intake/types.js";

const PLANNER_ROLE: AgentRole = "planner";

/**
 * Run the planner agent. It writes a plan file to planFilePath.
 * Returns the raw output text (the plan is on disk, not in the return value).
 */
export async function runPlanner(
  config: ShipwrightConfig,
  sprint: SprintPlan,
  planFilePath: string,
  prdFilePath: string,
  scoutReports: string,
  expertiseContext: string
): Promise<string> {
  const systemPrompt = loadPromptFile("planner.md");

  const parts: string[] = [
    `## Task`,
    `Create a sprint implementation plan and write it to: ${planFilePath}`,
    "",
    `## Sprint: ${sprint.title}`,
    `Description: ${sprint.description}`,
    "",
    `## PRD File`,
    `Read the full PRD at: ${prdFilePath}`,
    "",
  ];

  if (sprint.acceptanceCriteria.length > 0) {
    parts.push("## Acceptance Criteria (from PRD):");
    for (const ac of sprint.acceptanceCriteria) {
      parts.push(`- [${ac.id}] ${ac.text}`);
    }
    parts.push("");
  }

  if (sprint.fileTargets.length > 0) {
    parts.push("## Expected File Targets:");
    for (const f of sprint.fileTargets) {
      parts.push(`- ${f}`);
    }
    parts.push("");
  }

  if (scoutReports) {
    parts.push(scoutReports, "");
  }

  if (expertiseContext) {
    parts.push(expertiseContext, "");
  }

  parts.push(
    "Write the complete plan to the file path specified above.",
    "Follow the exact plan format from your system prompt.",
    "Each step must be a small, atomic feature with exact file paths.",
    "The generator will read this file and implement it top to bottom.",
  );

  const result = await runAgent({
    role: PLANNER_ROLE,
    systemPrompt,
    userPrompt: parts.join("\n"),
    tools: AGENT_TOOLS[PLANNER_ROLE],
    model: config.models.planner,
    maxTurns: undefined, // Unlimited
    workingDir: config.target.dir,
  });

  return result.output;
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a planner. Write a step-by-step implementation plan to the specified file.`;
  }
}
