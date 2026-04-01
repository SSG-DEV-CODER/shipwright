/**
 * Improver Agent — extracts learnings from completed sprints and updates expertise
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import type { ShipwrightConfig } from "../config.js";
import type { SprintContract, BuildAttempt } from "../pipeline/types.js";
import type { ExpertiseUpdate } from "../expertise/types.js";

const IMPROVER_ROLE: AgentRole = "improver";

export async function runImprover(
  config: ShipwrightConfig,
  contract: SprintContract,
  attempts: BuildAttempt[],
  existingExpertiseSummary: string
): Promise<ExpertiseUpdate> {
  const systemPrompt = loadPromptFile("improver.md");

  const parts: string[] = [
    `## Completed Sprint: ${contract.title}`,
    "",
    `## Contract`,
    `Steps: ${contract.implementation.steps.length}`,
    `Files created: ${contract.implementation.filesToCreate.join(", ") || "none"}`,
    `Files modified: ${contract.implementation.filesToModify.join(", ") || "none"}`,
    "",
    `## Build History (${attempts.length} attempts)`,
  ];

  for (const attempt of attempts) {
    parts.push(
      `### Attempt ${attempt.attempt}: ${attempt.evalResult.passed ? "PASSED" : "FAILED"} (${attempt.evalResult.overallScore}/10)`
    );
    if (!attempt.evalResult.passed) {
      parts.push(`Failures: ${attempt.evalResult.failureReasons.join("; ")}`);
    }
    if (attempt.evalResult.feedback) {
      parts.push(`Feedback: ${attempt.evalResult.feedback.slice(0, 500)}`);
    }
    parts.push("");
  }

  parts.push(
    `## Files Changed in Final Build`,
    attempts[attempts.length - 1]?.filesChanged.join("\n") ?? "none",
    "",
    `## Existing Expertise`,
    existingExpertiseSummary || "No existing expertise for this domain.",
    "",
    "Extract learnings as JSON with: domain, newPatterns, newGotchas, newDecisions, corrections, removals.",
  );

  const result = await runAgent({
    role: IMPROVER_ROLE,
    systemPrompt,
    userPrompt: parts.join("\n"),
    tools: AGENT_TOOLS[IMPROVER_ROLE],
    model: config.models.improver,
    maxTurns: 15,
    workingDir: config.target.dir,
    mcpServers: config.mcpServers,
  });

  return extractJson<ExpertiseUpdate>(
    result.output,
    ["domain", "newPatterns"],
    {
      domain: "general",
      newPatterns: [],
      newGotchas: [],
      newDecisions: [],
      corrections: [],
      removals: [],
    }
  );
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are an expertise curator. Extract learnings from the completed sprint.`;
  }
}
