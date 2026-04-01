/**
 * Unified agent runner — single interface for both Claude and Codex
 *
 * Routes to the correct SDK based on the model string:
 * - Model contains "codex" → @openai/codex-sdk (Codex CLI subscription)
 * - Everything else → @anthropic-ai/claude-code (Claude CLI subscription)
 *
 * Both SDKs wrap their respective CLI binaries. No API billing beyond subscriptions.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
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
  outputSchema?: string; // Path to JSON Schema — used by Codex, ignored by Claude
  mcpServers?: Record<string, any>; // MCP servers passed to Claude SDK (ignored by Codex)
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

// Shared verbose flag
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
 * Run an agent — routes to Claude or Codex SDK based on model string.
 *
 * This is the ONLY entry point for all agent invocations.
 */
export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const isCodex = options.model.toLowerCase().includes("codex");

  if (isCodex) {
    return runCodexAgent(options);
  } else {
    return runClaudeAgent(options);
  }
}

// ─── Claude SDK Path ───────────────────────────────────────────────

async function runClaudeAgent(options: AgentOptions): Promise<AgentResult> {
  const start = Date.now();
  const verbose = options.verbose ?? _verbose;

  let toolCallCount = 0;
  const heartbeat = setInterval(() => {
    agentLog("HEARTBEAT", `${options.role} working (${formatElapsed(Date.now() - start)}, ${toolCallCount} tool calls)`);
  }, 60_000);

  let query: Function;
  try {
    const sdk = await import("@anthropic-ai/claude-code");
    query = sdk.query;
  } catch {
    clearInterval(heartbeat);
    console.warn(`[${options.role}] Claude Code SDK not available. Returning stub.`);
    return stubResult(options, start);
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
        ...(options.mcpServers && Object.keys(options.mcpServers).length > 0
          ? { mcpServers: options.mcpServers }
          : {}),
      },
    });

    let lastAssistantText = "";
    let resultText = "";

    for await (const event of stream) {
      if (event.type === "assistant" && Array.isArray(event.message?.content)) {
        for (const block of event.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolCallCount++;
            if (verbose) {
              const detail = extractToolDetail(block.name, block.input as Record<string, unknown>);
              agentLog(options.role, `Tool: ${block.name}${detail ? ` ${detail}` : ""}`);
            }
          }
          if (block.type === "text" && block.text) {
            lastAssistantText = block.text;
            fullOutput += block.text;
          }
        }
      }
      if (event.type === "result") {
        if (event.usage) {
          inputTokens += event.usage.input_tokens ?? 0;
          outputTokens += event.usage.output_tokens ?? 0;
        }
        if (event.text) resultText = event.text;
      }
    }

    if (resultText) {
      fullOutput = resultText;
    } else if (lastAssistantText && lastAssistantText.includes("{")) {
      fullOutput = lastAssistantText;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[${options.role}] Claude agent error: ${errMsg}`);
    if (!fullOutput.trim()) {
      fullOutput = `[ERROR] Agent ${options.role} failed: ${errMsg}`;
    }
  }

  clearInterval(heartbeat);
  const durationMs = Date.now() - start;
  agentLog(options.role, `Done (${formatElapsed(durationMs)}, ${toolCallCount} tool calls, ${inputTokens + outputTokens} tokens)`);

  return {
    output: fullOutput,
    costEntry: {
      agent: options.role,
      model: options.model,
      inputTokens,
      outputTokens,
      costUsd: estimateCost(options.model, inputTokens, outputTokens),
      timestamp: new Date().toISOString(),
    },
    durationMs,
  };
}

// ─── Codex SDK Path ────────────────────────────────────────────────

async function runCodexAgent(options: AgentOptions): Promise<AgentResult> {
  const start = Date.now();
  const verbose = options.verbose ?? _verbose;

  const heartbeat = setInterval(() => {
    agentLog("HEARTBEAT", `${options.role} [codex] working (${formatElapsed(Date.now() - start)})`);
  }, 60_000);

  try {
    const { Codex } = await import("@openai/codex-sdk");

    const codex = new Codex();
    const thread = codex.startThread({
      sandboxMode: "full-auto",
      workingDirectory: resolve(options.workingDir ?? process.cwd()),
      skipGitRepoCheck: true,
      approvalPolicy: "never",
    });

    const fullPrompt = [options.systemPrompt, "", "---", "", options.userPrompt].join("\n");

    // Load output schema if provided
    let outputSchema: unknown | undefined;
    if (options.outputSchema) {
      try {
        outputSchema = JSON.parse(readFileSync(resolve(options.outputSchema), "utf-8"));
      } catch (err) {
        agentLog(options.role, `Warning: could not load output schema: ${err}`);
      }
    }

    agentLog(options.role, "Starting [codex]...");
    const result = await thread.run(fullPrompt, { outputSchema });

    // Verbose: log items
    if (verbose && result.items) {
      for (const item of result.items) {
        if (item.type === "command_execution") {
          agentLog(options.role, `Tool: Bash \`${(item as { command?: string }).command?.slice(0, 60) ?? "..."}\``);
        } else if (item.type === "agent_message") {
          agentLog(options.role, `Message: ${(item as { text?: string }).text?.slice(0, 80) ?? "..."}`);
        }
      }
    }

    clearInterval(heartbeat);
    const durationMs = Date.now() - start;
    const usage = result.usage;
    agentLog(options.role, `Done [codex] (${formatElapsed(durationMs)}, ${result.items?.length ?? 0} items)`);

    return {
      output: result.finalResponse ?? "",
      costEntry: {
        agent: options.role,
        model: "codex",
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        costUsd: 0, // Subscription — no per-token cost
        timestamp: new Date().toISOString(),
      },
      durationMs,
    };
  } catch (err) {
    clearInterval(heartbeat);
    const errMsg = err instanceof Error ? err.message : String(err);
    agentLog(options.role, `Codex error: ${errMsg}`);

    return {
      output: `[ERROR] Codex agent ${options.role} failed: ${errMsg}`,
      costEntry: {
        agent: options.role,
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

// ─── Helpers ───────────────────────────────────────────────────────

function stubResult(options: AgentOptions, start: number): AgentResult {
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

function extractToolDetail(toolName: string, input?: Record<string, unknown>): string {
  if (!input) return "";
  switch (toolName) {
    case "Write":
    case "Edit":
    case "Read":
      return input.file_path ? String(input.file_path).split("/").slice(-2).join("/") : "";
    case "Bash":
      return input.command ? `\`${String(input.command).slice(0, 60)}\`` : "";
    case "Glob":
      return input.pattern ? String(input.pattern) : "";
    case "Grep":
      return input.pattern ? `/${input.pattern}/` : "";
    default:
      return "";
  }
}
