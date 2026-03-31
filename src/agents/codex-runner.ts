/**
 * Codex Runner — invokes OpenAI Codex CLI for the evaluator role
 *
 * Separate from the Claude Code SDK path. Uses `codex exec` with:
 * - --sandbox read-only (evaluator cannot modify files)
 * - --output-last-message (captures final text output)
 * - --dangerously-bypass-approvals-and-sandbox for automated use
 * - --json for structured event stream
 */

import { spawn } from "child_process";
import { resolve, join } from "path";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { estimateCost, type CostEntry } from "../lib/cost.js";
import type { AgentRole } from "./base.js";

export interface CodexRunnerOptions {
  systemPrompt: string;
  userPrompt: string;
  workingDir: string;
  model?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
}

export interface CodexRunnerResult {
  output: string;
  costEntry: CostEntry;
  durationMs: number;
  exitCode: number;
}

/**
 * Check if the Codex CLI is available.
 */
export async function isCodexAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["codex", "--version"], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Run a prompt through the Codex CLI in non-interactive mode.
 */
export async function runCodex(options: CodexRunnerOptions): Promise<CodexRunnerResult> {
  const start = Date.now();
  const tmpDir = mkdtempSync(join(tmpdir(), "shipwright-codex-"));
  const outputFile = join(tmpDir, "output.txt");

  // Build the full prompt with system prompt prepended
  const fullPrompt = [
    options.systemPrompt,
    "",
    "---",
    "",
    options.userPrompt,
  ].join("\n");

  const args = [
    "exec",
    "--sandbox", options.sandbox ?? "read-only",
    "--dangerously-bypass-approvals-and-sandbox",
    "--output-last-message", outputFile,
    "--cd", resolve(options.workingDir),
    "--skip-git-repo-check",
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  // Pass prompt via stdin
  args.push("-"); // Read from stdin

  return new Promise<CodexRunnerResult>((resolvePromise) => {
    let stderrOutput = "";

    const proc = spawn("codex", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: resolve(options.workingDir),
    });

    // Write prompt to stdin
    proc.stdin?.write(fullPrompt);
    proc.stdin?.end();

    // Capture stderr for debugging
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    // Capture stdout (JSONL events if --json was used, otherwise text)
    let stdoutOutput = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutOutput += chunk.toString();
    });

    proc.on("close", (code) => {
      const durationMs = Date.now() - start;

      // Read the output file (last message from agent)
      let output = "";
      try {
        if (existsSync(outputFile)) {
          output = readFileSync(outputFile, "utf-8").trim();
        }
      } catch {
        // Fall through
      }

      // Fallback to stdout if output file is empty
      if (!output && stdoutOutput) {
        output = stdoutOutput.trim();
      }

      // If still empty, use stderr as diagnostic
      if (!output) {
        output = `[Codex exec completed with code ${code}. No output captured.]`;
        if (stderrOutput) {
          console.warn(`[codex] stderr: ${stderrOutput.slice(0, 500)}`);
        }
      }

      // Clean up temp files
      try {
        const { rmSync } = require("fs");
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Non-critical
      }

      resolvePromise({
        output,
        costEntry: {
          agent: "evaluator" as AgentRole,
          model: options.model ?? "codex",
          inputTokens: 0, // Codex is subscription — no per-token tracking
          outputTokens: 0,
          costUsd: 0,
          timestamp: new Date().toISOString(),
        },
        durationMs,
        exitCode: code ?? 1,
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill("SIGTERM");
    }, 300_000);
  });
}
