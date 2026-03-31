/**
 * Planner Agent — produces implementation plans from PRD + expertise + scout reports
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintPlan } from "../intake/types.js";
import type { SprintContract, ScoutReport } from "../pipeline/types.js";

const PLANNER_ROLE: AgentRole = "planner";

export interface PlannerOutput {
  steps: Array<{
    order: number;
    description: string;
    targetFiles: string[];
  }>;
  filesToCreate: string[];
  filesToModify: string[];
  validationCommands: string[];
  evaluationCriteria: Array<{
    criterion: string;
    specificChecks: string[];
  }>;
}

export async function runPlanner(
  config: ShipwrightConfig,
  sprint: SprintPlan,
  scoutReports: string,
  expertiseContext: string
): Promise<PlannerOutput> {
  const systemPrompt = loadPromptFile("planner.md");

  const userPrompt = [
    `## Sprint to Plan`,
    `Title: ${sprint.title}`,
    `Description: ${sprint.description}`,
    "",
    sprint.acceptanceCriteria.length > 0
      ? `## Acceptance Criteria\n${sprint.acceptanceCriteria.map((c) => `- [${c.id}] ${c.text}`).join("\n")}`
      : "",
    sprint.fileTargets.length > 0
      ? `## Expected File Targets\n${sprint.fileTargets.map((f) => `- ${f}`).join("\n")}`
      : "",
    "",
    scoutReports,
    "",
    expertiseContext,
    "",
    "Produce your plan as JSON with: steps, filesToCreate, filesToModify, validationCommands, evaluationCriteria.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await runAgent({
    role: PLANNER_ROLE,
    systemPrompt,
    userPrompt,
    tools: AGENT_TOOLS[PLANNER_ROLE],
    model: config.models.planner,
    maxTurns: 20,
    workingDir: config.target.dir,
  });

  return extractJson<PlannerOutput>(result.output, ["steps", "filesToCreate"], {
    steps: [],
    filesToCreate: [],
    filesToModify: [],
    validationCommands: [config.target.typecheckCmd],
    evaluationCriteria: [],
  });
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a ${filename.replace(".md", "")} agent.`;
  }
}
