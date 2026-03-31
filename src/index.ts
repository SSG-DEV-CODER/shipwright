#!/usr/bin/env bun
/**
 * Shipwright CLI — Adversarial build system with expert learning
 *
 * Usage:
 *   shipwright build <prd-path> [options]    Run a PRD through the adversarial pipeline
 *   shipwright expertise <command> [args]    Manage expertise files
 *   shipwright status                       Show current pipeline state
 *   shipwright resume                       Resume interrupted pipeline
 *   shipwright init                         Create shipwright.yaml in current directory
 *   shipwright help                         Show this help
 */

import { loadConfig, applyCliOverrides } from "./config.js";

const VERSION = "0.1.0";

interface ParsedArgs {
  command: string;
  subcommand?: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip bun and script path
  const command = args[0] ?? "help";
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  return { command, subcommand: positional[0], positional, flags };
}

async function runBuild(args: ParsedArgs): Promise<void> {
  const prdPath = args.positional[0];
  if (!prdPath) {
    console.error("Error: PRD file path required");
    console.error("Usage: shipwright build <prd-path> [options]");
    process.exit(1);
  }

  const config = applyCliOverrides(
    loadConfig(args.flags.config as string | undefined),
    args.flags as Record<string, string>
  );

  console.log(`\n⚓ Shipwright v${VERSION}`);
  console.log(`   PRD: ${prdPath}`);
  console.log(`   Target: ${config.target.dir}`);
  console.log(`   Models: planner=${config.models.planner}, generator=${config.models.generator}`);
  console.log(`   Max retries: ${config.pipeline.maxRetries}`);
  console.log(`   Pass threshold: ${config.pipeline.evalPassThreshold}/10\n`);

  if (args.flags["dry-run"]) {
    console.log("   Mode: DRY RUN (plan + negotiate only)\n");
  }

  // TODO: Sprint 2+ — wire up pipeline orchestrator
  console.log("Pipeline orchestrator not yet implemented. Coming in Sprint 3.");
}

async function runExpertise(args: ParsedArgs): Promise<void> {
  const subcmd = args.positional[0];

  switch (subcmd) {
    case "list":
      // TODO: Sprint 5 — list expertise files
      console.log("Expertise list not yet implemented. Coming in Sprint 5.");
      break;
    case "validate":
      console.log("Expertise validate not yet implemented. Coming in Sprint 5.");
      break;
    case "improve":
      console.log("Expertise improve not yet implemented. Coming in Sprint 5.");
      break;
    case "create":
      console.log("Expertise create not yet implemented. Coming in Sprint 5.");
      break;
    case "question":
      console.log("Expertise question not yet implemented. Coming in Sprint 5.");
      break;
    default:
      console.error(`Unknown expertise command: ${subcmd}`);
      console.error("Available: list, validate, improve, create, question");
      process.exit(1);
  }
}

async function showStatus(): Promise<void> {
  // TODO: Sprint 4 — read .shipwright/state.json
  console.log("Status not yet implemented. Coming in Sprint 4.");
}

async function resumePipeline(): Promise<void> {
  // TODO: Sprint 5 — resume from checkpoint
  console.log("Resume not yet implemented. Coming in Sprint 5.");
}

async function initConfig(): Promise<void> {
  const { existsSync, copyFileSync } = await import("fs");
  const { resolve } = await import("path");

  const target = resolve("shipwright.yaml");
  if (existsSync(target)) {
    console.error("shipwright.yaml already exists in current directory.");
    process.exit(1);
  }

  const template = resolve(import.meta.dir, "../templates/shipwright.yaml");
  if (existsSync(template)) {
    copyFileSync(template, target);
    console.log("Created shipwright.yaml from template.");
  } else {
    console.log("Template not found. Create shipwright.yaml manually.");
  }
}

function showHelp(): void {
  console.log(`
⚓ Shipwright v${VERSION} — Adversarial build system with expert learning

USAGE:
  shipwright <command> [options]

COMMANDS:
  build <prd-path>         Run a PRD through the adversarial pipeline
  expertise <subcmd>       Manage expertise files (list|validate|improve|create|question)
  status                   Show current pipeline state
  resume                   Resume interrupted pipeline from checkpoint
  init                     Create shipwright.yaml in current directory
  help                     Show this help

BUILD OPTIONS:
  --config <path>          Config file (default: shipwright.yaml)
  --sprint <n>             Run only sprint N
  --dry-run                Plan + negotiate only, don't generate code
  --max-retries <n>        Max retries per sprint (default: 3)
  --target-dir <path>      Directory to build in (default: .)
  --expertise-dir <path>   Expertise files directory
  --reference <path>       Reference codebase to scout (repeatable)
  --verbose                Verbose logging
  --no-commit              Skip git commits
  --no-improve             Skip expertise self-improvement
  --model-override <r>=<m> Override model for a role (e.g., planner=claude-sonnet-4-20250514)

EXAMPLES:
  shipwright build docs/plans/PRD-feature.md
  shipwright build PRD.md --target-dir ../other-repo --dry-run
  shipwright expertise list
  shipwright expertise improve nextjs-payload
  shipwright init
`);
}

// --- Main ---

const args = parseArgs(process.argv);

switch (args.command) {
  case "build":
    await runBuild(args);
    break;
  case "expertise":
    await runExpertise(args);
    break;
  case "status":
    await showStatus();
    break;
  case "resume":
    await resumePipeline();
    break;
  case "init":
    await initConfig();
    break;
  case "help":
  case "--help":
  case "-h":
    showHelp();
    break;
  case "version":
  case "--version":
  case "-v":
    console.log(`Shipwright v${VERSION}`);
    break;
  default:
    console.error(`Unknown command: ${args.command}`);
    showHelp();
    process.exit(1);
}
