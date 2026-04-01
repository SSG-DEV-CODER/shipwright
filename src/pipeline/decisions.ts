/**
 * Decision pause/resume — file-based human-in-the-loop mechanism
 *
 * When the pipeline encounters a DECISION failure (a choice the PRD doesn't specify),
 * it writes a decision file, notifies the human, and pauses. The human edits the file
 * with their answer, then runs `shipwright resume`.
 */

import { execSync } from "child_process";
import { resolve } from "path";
import { writeJsonFile, readJsonFile, writeText } from "../lib/fs.js";
import type { DecisionRequest, DecisionAnswer } from "./types.js";

// ANSI escape codes for terminal banner
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

interface PendingDecision extends DecisionRequest {
  answer: string;
  answeredAt: string;
  answeredBy: string;
}

/**
 * Write the decision files — both machine-readable JSON and human-readable markdown.
 */
export function writeDecisionRequired(
  stateDir: string,
  decision: DecisionRequest,
): void {
  // Machine-readable — human fills in "answer" field
  const pending: PendingDecision = {
    ...decision,
    answer: "",
    answeredAt: "",
    answeredBy: "",
  };
  writeJsonFile(resolve(stateDir, "decisions-pending.json"), pending);

  // Human-readable markdown
  const md = formatDecisionMarkdown(decision);
  writeText(resolve(stateDir, "DECISION-REQUIRED.md"), md);
}

/**
 * Read the human's decision answer. Returns null if no answer yet.
 */
export function readDecisionAnswer(stateDir: string): DecisionAnswer | null {
  const filePath = resolve(stateDir, "decisions-pending.json");
  const data = readJsonFile<PendingDecision>(filePath);

  if (!data || !data.answer || data.answer.trim() === "") {
    return null;
  }

  return {
    question: data.question,
    answer: data.answer.trim(),
    answeredAt: data.answeredAt || new Date().toISOString(),
    answeredBy: data.answeredBy || "human",
  };
}

/**
 * Notify the human via terminal banner and macOS notification.
 */
export function notifyHuman(decision: DecisionRequest): void {
  // Terminal banner
  const width = 60;
  const border = "═".repeat(width);
  const pad = (s: string) => {
    const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
    const padding = Math.max(0, width - visible.length);
    return s + " ".repeat(padding);
  };

  console.log("");
  console.log(`${CYAN}⚓ ${border}${RESET}`);
  console.log(`${CYAN}  ${BOLD}${RED}DECISION REQUIRED${RESET}${CYAN} — Pipeline Paused${RESET}`);
  console.log(`${CYAN}  ${border}${RESET}`);
  console.log("");
  console.log(`  ${BOLD}Sprint:${RESET}   ${decision.sprint}`);
  console.log(`  ${BOLD}Attempt:${RESET}  ${decision.attempt}`);
  console.log("");
  console.log(`  ${BOLD}${YELLOW}Question:${RESET}`);

  // Word-wrap the question for readability
  const words = decision.question.split(" ");
  let line = "  ";
  for (const word of words) {
    if (line.length + word.length > width) {
      console.log(line);
      line = "  " + word;
    } else {
      line += (line.trim() === "" ? "" : " ") + word;
    }
  }
  if (line.trim()) console.log(line);

  if (decision.options.length > 0) {
    console.log("");
    console.log(`  ${BOLD}Options:${RESET}`);
    for (const opt of decision.options) {
      console.log(`    - ${opt}`);
    }
  }

  console.log("");
  console.log(`  ${BOLD}To answer:${RESET}`);
  console.log(`    1. Edit ${CYAN}.shipwright/decisions-pending.json${RESET}`);
  console.log(`    2. Set ${BOLD}"answer"${RESET} to your choice`);
  console.log(`    3. Run: ${CYAN}shipwright resume${RESET}`);
  console.log("");
  console.log(`${CYAN}⚓ ${border}${RESET}`);
  console.log("");

  // macOS native notification (best-effort)
  try {
    const msg = `Sprint ${decision.sprint} paused — decision required`;
    execSync(
      `osascript -e 'display notification "${msg}" with title "⚓ Shipwright" sound name "Glass"'`,
      { stdio: "pipe", timeout: 5000 },
    );
  } catch {
    // Not macOS or notification not available — non-fatal
  }
}

/**
 * Format a human-readable markdown document explaining the decision needed.
 */
export function formatDecisionMarkdown(decision: DecisionRequest): string {
  const lines: string[] = [
    `# ⚓ Decision Required`,
    ``,
    `**Sprint:** ${decision.sprint}`,
    `**Attempt:** ${decision.attempt}`,
    `**Time:** ${decision.timestamp}`,
    ``,
    `## Question`,
    ``,
    decision.question,
    ``,
  ];

  if (decision.options.length > 0) {
    lines.push(`## Options`, ``);
    for (let i = 0; i < decision.options.length; i++) {
      lines.push(`${i + 1}. ${decision.options[i]}`);
    }
    lines.push(``);
  }

  if (decision.context) {
    lines.push(`## Context`, ``, decision.context, ``);
  }

  lines.push(
    `## How to Answer`,
    ``,
    `1. Edit \`.shipwright/decisions-pending.json\``,
    `2. Set the \`"answer"\` field to your choice`,
    `3. Run: \`shipwright resume\``,
    ``,
    `The pipeline will continue with your decision incorporated into the build context.`,
  );

  return lines.join("\n");
}
