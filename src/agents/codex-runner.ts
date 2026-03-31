/**
 * Codex Runner — invokes OpenAI Codex SDK for the evaluator role
 *
 * Uses @openai/codex-sdk (proper JavaScript API) instead of CLI spawn.
 * This matches how adversarial-dev uses Codex and avoids all stdout/file
 * capture issues from the CLI wrapper approach.
 *
 * The SDK handles:
 * - Sandbox enforcement (read-only for evaluator)
 * - Structured output via outputSchema (guaranteed valid JSON)
 * - Tool execution (bash, file reads)
 * - Session management
 */

import { resolve } from "path";
import { readFileSync } from "fs";
import { estimateCost, type CostEntry } from "../lib/cost.js";
import { isVerbose } from "./base.js";
import type { AgentRole } from "./base.js";

export interface CodexRunnerOptions {
  systemPrompt: string;
  userPrompt: string;
  workingDir: string;
  outputSchema?: string; // Path to JSON Schema file
}

export interface CodexRunnerResult {
  output: string;
  costEntry: CostEntry;
  durationMs: number;
}

/**
 * Check if the Codex SDK can be imported.
 */
export async function isCodexAvailable(): Promise<boolean> {
  try {
    await import("@openai/codex-sdk");
    return true;
  } catch {
    return false;
  }
}

function agentLog(message: string): void {
  const ts = new Date().toISOString().split("T")[1].replace("Z", "");
  console.log(`[${ts}] [CODEX-EVAL] ${message}`);
}

/**
 * Run an evaluation through the Codex SDK.
 */
export async function runCodex(options: CodexRunnerOptions): Promise<CodexRunnerResult> {
  const start = Date.now();
  const verbose = isVerbose();

  // Heartbeat
  const heartbeat = setInterval(() => {
    const elapsed = Math.round((Date.now() - start) / 1000);
    agentLog(`working (${elapsed}s elapsed)`);
  }, 60_000);

  try {
    const { Codex } = await import("@openai/codex-sdk");

    const codex = new Codex();
    const thread = codex.startThread({
      sandboxMode: "read-only",
      workingDirectory: resolve(options.workingDir),
      skipGitRepoCheck: true,
      approvalPolicy: "never",
    });

    // Build the prompt (system + user combined — Codex doesn't have separate system prompt)
    const fullPrompt = [
      options.systemPrompt,
      "",
      "---",
      "",
      options.userPrompt,
    ].join("\n");

    // Load output schema if provided
    let outputSchema: unknown | undefined;
    if (options.outputSchema) {
      try {
        outputSchema = JSON.parse(readFileSync(resolve(options.outputSchema), "utf-8"));
      } catch (err) {
        agentLog(`Warning: could not load output schema: ${err}`);
      }
    }

    // Run with optional structured output
    agentLog("Starting evaluation...");
    const result = await thread.run(fullPrompt, {
      outputSchema,
    });

    // Extract output
    const output = result.finalResponse ?? "";
    const usage = result.usage;

    // Log items in verbose mode
    if (verbose && result.items) {
      for (const item of result.items) {
        if (item.type === "command_execution") {
          agentLog(`Tool: Bash \`${(item as { command?: string }).command?.slice(0, 60) ?? "..."}\``);
        } else if (item.type === "agent_message") {
          agentLog(`Message: ${(item as { text?: string }).text?.slice(0, 80) ?? "..."}`);
        }
      }
    }

    clearInterval(heartbeat);
    const durationMs = Date.now() - start;
    agentLog(`Done (${Math.round(durationMs / 1000)}s, ${result.items?.length ?? 0} items)`);

    return {
      output,
      costEntry: {
        agent: "evaluator" as AgentRole,
        model: "codex",
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        costUsd: 0, // Codex is subscription — no per-token cost
        timestamp: new Date().toISOString(),
      },
      durationMs,
    };
  } catch (err) {
    clearInterval(heartbeat);
    const errMsg = err instanceof Error ? err.message : String(err);
    agentLog(`Error: ${errMsg}`);

    return {
      output: `[ERROR] Codex evaluator failed: ${errMsg}`,
      costEntry: {
        agent: "evaluator" as AgentRole,
        model: "codex",
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        timestamp: new Date().toISOString(),
      },
      durationMs: Date.now() - start,
    };
  }
}
