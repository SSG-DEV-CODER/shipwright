/**
 * Generator Agent — implements code according to a sprint plan file
 *
 * Design decisions (see docs/decisions/001-generator-pattern.md):
 * - Reads plan from file on disk (not from prompt) — can re-reference as needed
 * - Reads feedback from file on disk on retries — consistent pattern
 * - Harness does NOT parse generator output — uses git diff to detect changes
 * - persistSession: true — remembers incremental work within a sprint
 * - maxTurns: undefined (unlimited) — runs until plan is complete
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import type { ShipwrightConfig } from "../config.js";

const GENERATOR_ROLE: AgentRole = "generator";

/**
 * Run the generator agent.
 *
 * @param planFilePath — path to the sprint plan file (markdown)
 * @param feedbackFilePath — optional path to evaluation feedback file (retry)
 *
 * Returns raw text output (not parsed — harness uses git diff instead).
 */
export async function runGenerator(
  config: ShipwrightConfig,
  planFilePath: string,
  feedbackFilePath?: string
): Promise<string> {
  const systemPrompt = loadPromptFile("generator.md");

  const parts: string[] = [
    `Your working directory is: ${resolve(config.target.dir)}`,
    `The sprint plan file is at: ${planFilePath}`,
    "",
  ];

  if (feedbackFilePath) {
    parts.push(
      `IMPORTANT: This is a RETRY after a failed evaluation.`,
      `Read the feedback file FIRST: ${feedbackFilePath}`,
      `Address every issue in the feedback, then continue with the plan.`,
      "",
    );
  }

  parts.push(
    "Read the sprint plan file and implement it top to bottom.",
    "Build ONE feature at a time. Git commit after each. Do not stop until every step is done.",
  );

  const result = await runAgent({
    role: GENERATOR_ROLE,
    systemPrompt,
    userPrompt: parts.join("\n"),
    tools: AGENT_TOOLS[GENERATOR_ROLE],
    model: config.models.generator,
    maxTurns: undefined, // Unlimited — runs until plan is complete
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
    return `You are a software engineer. Read the plan file and implement it top to bottom. Commit after each feature.`;
  }
}
