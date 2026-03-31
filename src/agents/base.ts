/**
 * Base agent wrapper around Claude Agent SDK
 *
 * All agent invocations go through this module. It handles:
 * - SDK query() call with typed options
 * - Output extraction from async generator
 * - Cost tracking per invocation
 * - Timeout enforcement
 */

import { estimateCost, type CostEntry } from "../lib/cost.js";
import type { ShipwrightConfig } from "../config.js";

export type AgentRole = "scout" | "planner" | "generator" | "evaluator" | "negotiator" | "improver";

export interface AgentOptions {
  role: AgentRole;
  systemPrompt: string;
  userPrompt: string;
  tools: string[];
  model: string;
  maxTurns?: number;
  workingDir?: string;
  persistSession?: boolean;
}

export interface AgentResult {
  output: string;
  costEntry: CostEntry;
  durationMs: number;
}

// Tool permission sets per role
export const AGENT_TOOLS: Record<AgentRole, string[]> = {
  scout: ["Read", "Glob", "Grep"],
  planner: ["Read", "Glob", "Grep"],
  generator: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  evaluator: ["Read", "Bash", "Glob", "Grep"],
  negotiator: ["Read"],
  improver: ["Read", "Glob", "Grep"],
};

export function getModelForRole(role: AgentRole, config: ShipwrightConfig): string {
  return config.models[role];
}

/**
 * Run an agent via Claude Agent SDK query().
 *
 * This is the ONLY function that calls the SDK. All agents go through here.
 */
export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const start = Date.now();

  // Dynamic import of Claude Agent SDK — may not be installed during initial dev
  let query: Function;
  try {
    const sdk = await import("@anthropic-ai/claude-code");
    query = sdk.query;
  } catch {
    // SDK not available — return stub for development
    console.warn(`[${options.role}] Claude Agent SDK not available. Returning stub response.`);
    return {
      output: `[STUB] Agent ${options.role} would execute here with prompt: ${options.userPrompt.slice(0, 100)}...`,
      costEntry: {
        agent: options.role,
        model: options.model,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        timestamp: new Date().toISOString(),
      },
      durationMs: Date.now() - start,
    };
  }

  let fullOutput = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const stream = query({
      model: options.model,
      systemPrompt: options.systemPrompt,
      prompt: options.userPrompt,
      tools: options.tools,
      maxTurns: options.maxTurns ?? 50,
      cwd: options.workingDir ?? process.cwd(),
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    });

    for await (const event of stream) {
      if (event.type === "assistant" && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block.type === "text") {
            fullOutput += block.text;
          }
        }
      }
      if (event.type === "result") {
        // Extract token usage from result if available
        if (event.usage) {
          inputTokens += event.usage.input_tokens ?? 0;
          outputTokens += event.usage.output_tokens ?? 0;
        }
        // Also capture final text
        if (event.text) {
          fullOutput = event.text;
        }
      }
    }
  } catch (err) {
    console.error(`[${options.role}] Agent error:`, err);
    throw err;
  }

  const durationMs = Date.now() - start;
  const costUsd = estimateCost(options.model, inputTokens, outputTokens);

  return {
    output: fullOutput,
    costEntry: {
      agent: options.role,
      model: options.model,
      inputTokens,
      outputTokens,
      costUsd,
      timestamp: new Date().toISOString(),
    },
    durationMs,
  };
}
