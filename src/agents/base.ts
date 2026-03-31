/**
 * Base agent wrapper around Claude Agent SDK
 *
 * All agent invocations go through this module. It handles:
 * - SDK query() call with typed options
 * - Output extraction from async generator
 * - Cost tracking per invocation
 * - Heartbeat logging (every 60s, default)
 * - Verbose tool streaming (--verbose)
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
  verbose?: boolean;
}

export interface AgentResult {
  output: string;
  costEntry: CostEntry;
  durationMs: number;
}

// Tool permission sets per role
export const AGENT_TOOLS: Record<AgentRole, string[]> = {
  scout: ["Read", "Glob", "Grep"],
  planner: ["Read", "Glob", "Grep", "Write"],
  generator: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  evaluator: ["Read", "Bash", "Glob", "Grep"],
  negotiator: ["Read"],
  improver: ["Read", "Glob", "Grep"],
};

export function getModelForRole(role: AgentRole, config: ShipwrightConfig): string {
  return config.models[role];
}

// Shared verbose flag — set by orchestrator before pipeline runs
let _verbose = false;
export function setVerbose(v: boolean): void { _verbose = v; }
export function isVerbose(): boolean { return _verbose; }

function formatElapsed(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function agentLog(role: string, message: string): void {
  const ts = new Date().toISOString().split("T")[1].replace("Z", "");
  console.log(`[${ts}] [${role.toUpperCase().padEnd(10)}] ${message}`);
}

/**
 * Run an agent via Claude Agent SDK query().
 *
 * This is the ONLY function that calls the SDK. All agents go through here.
 *
 * Features:
 * - Heartbeat every 60s while agent is running (always on)
 * - Verbose tool-use logging when verbose=true or global verbose is set
 */
export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const start = Date.now();
  const verbose = options.verbose ?? _verbose;

  // --- Heartbeat timer ---
  let toolCallCount = 0;
  const heartbeat = setInterval(() => {
    const elapsed = formatElapsed(Date.now() - start);
    agentLog("HEARTBEAT", `${options.role} working (${elapsed} elapsed, ${toolCallCount} tool calls)`);
  }, 60_000);

  // Dynamic import of Claude Agent SDK
  let query: Function;
  try {
    const sdk = await import("@anthropic-ai/claude-code");
    query = sdk.query;
  } catch {
    clearInterval(heartbeat);
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
      prompt: options.userPrompt,
      options: {
        model: options.model,
        customSystemPrompt: options.systemPrompt,
        allowedTools: options.tools,
        ...(options.maxTurns !== undefined ? { maxTurns: options.maxTurns } : {}),
        cwd: options.workingDir ?? process.cwd(),
        permissionMode: "bypassPermissions",
      },
    });

    let lastAssistantText = "";
    let resultText = "";

    for await (const event of stream) {
      // --- Verbose: log tool use in real-time ---
      if (event.type === "assistant" && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolCallCount++;
            if (verbose) {
              // Extract a short description of what the tool is doing
              const input = block.input as Record<string, unknown> | undefined;
              const detail = extractToolDetail(block.name, input);
              agentLog(options.role, `Tool: ${block.name}${detail ? ` ${detail}` : ""}`);
            }
          }
          if (block.type === "text" && block.text) {
            lastAssistantText = block.text;
            fullOutput += block.text;
          }
        }
      }

      // Capture final result text
      if (event.type === "result") {
        if (event.usage) {
          inputTokens += event.usage.input_tokens ?? 0;
          outputTokens += event.usage.output_tokens ?? 0;
        }
        if (event.text) {
          resultText = event.text;
        }
      }
    }

    // Prefer result.text (final output), then last assistant text with JSON, then full accumulated
    if (resultText) {
      fullOutput = resultText;
    } else if (lastAssistantText && lastAssistantText.includes("{")) {
      fullOutput = lastAssistantText;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[${options.role}] Agent error: ${errMsg}`);
    if (fullOutput.trim()) {
      console.warn(`[${options.role}] Returning partial output (${fullOutput.length} chars)`);
    } else {
      fullOutput = `[ERROR] Agent ${options.role} failed: ${errMsg}`;
    }
  }

  clearInterval(heartbeat);

  const durationMs = Date.now() - start;
  const costUsd = estimateCost(options.model, inputTokens, outputTokens);

  // Final summary line (always shown)
  agentLog(options.role, `Done (${formatElapsed(durationMs)}, ${toolCallCount} tool calls, ${inputTokens + outputTokens} tokens)`);

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

/**
 * Extract a short description of what a tool call is doing.
 * Used for verbose logging.
 */
function extractToolDetail(toolName: string, input?: Record<string, unknown>): string {
  if (!input) return "";

  switch (toolName) {
    case "Write":
      return input.file_path ? String(input.file_path).split("/").slice(-2).join("/") : "";
    case "Edit":
      return input.file_path ? String(input.file_path).split("/").slice(-2).join("/") : "";
    case "Read":
      return input.file_path ? String(input.file_path).split("/").slice(-2).join("/") : "";
    case "Bash":
      const cmd = String(input.command ?? "").slice(0, 60);
      return cmd ? `\`${cmd}\`` : "";
    case "Glob":
      return input.pattern ? String(input.pattern) : "";
    case "Grep":
      return input.pattern ? `/${input.pattern}/` : "";
    default:
      return "";
  }
}
