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
import { runPipeline } from "./pipeline/orchestrator.js";
import { loadExpertise } from "./expertise/loader.js";
import { parsePRD } from "./intake/prd-parser.js";
import { deriveSprints } from "./intake/sprint-planner.js";
import { fileExists, readJsonFile, readText } from "./lib/fs.js";
import type { PipelineState } from "./pipeline/types.js";

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

  const result = await runPipeline(config, prdPath, {
    dryRun: args.flags["dry-run"] === true,
    sprintFilter: args.flags.sprint ? parseInt(args.flags.sprint as string, 10) : undefined,
    noCommit: args.flags["no-commit"] === true,
    noImprove: args.flags["no-improve"] === true,
    verbose: args.flags.verbose === true,
  });

  // Exit with appropriate code: 0=success, 1=failure, 2=awaiting decision
  process.exit(result.status === "complete" ? 0 : result.status === "awaiting_decision" ? 2 : 1);
}

async function runExpertise(args: ParsedArgs): Promise<void> {
  const subcmd = args.positional[0];

  const config = loadConfig(args.flags.config as string | undefined);

  switch (subcmd) {
    case "list": {
      const ctx = loadExpertise(config.expertise.dir);
      if (ctx.files.length === 0) {
        console.log("No expertise files found.");
      } else {
        console.log(`\n⚓ Expertise Files (${ctx.totalLines} total lines)\n`);
        for (const f of ctx.files) {
          const stability = f.content.metadata?.stability ?? "unknown";
          console.log(`  ${f.domain.padEnd(25)} ${String(f.lineCount).padStart(5)} lines  [${stability}]  ${f.lastUpdated}`);
        }
        console.log("");
      }
      break;
    }
    case "validate": {
      const domain = args.positional[1];
      if (!domain) { console.error("Usage: shipwright expertise validate <domain>"); process.exit(1); }
      const valCtx = loadExpertise(config.expertise.dir);
      const file = valCtx.files.find((f) => f.domain === domain);
      if (!file) { console.error(`Expertise file not found: ${domain}`); process.exit(1); }
      const { validateExpertise } = await import("./expertise/validator.js");
      const result = validateExpertise(file, config.target.dir);
      console.log(`\n⚓ Validation: ${domain}`);
      console.log(`   Claims: ${result.totalClaims} total, ${result.validClaims} valid`);
      if (result.missingFiles.length > 0) {
        console.log(`   Missing files: ${result.missingFiles.join(", ")}`);
      }
      if (result.issues.length > 0) {
        console.log(`   Issues:`);
        for (const issue of result.issues) console.log(`     - ${issue}`);
      }
      if (result.issues.length === 0) console.log("   No issues found.");
      console.log("");
      break;
    }
    case "improve": {
      const impDomain = args.positional[1];
      if (!impDomain) { console.error("Usage: shipwright expertise improve <domain>"); process.exit(1); }
      console.log(`Running self-improve for ${impDomain}... (requires Claude Agent SDK)`);
      const { runImprover } = await import("./agents/improver.js");
      const { applyExpertiseUpdate } = await import("./expertise/updater.js");
      const { resolve: resolvePath } = await import("path");
      const impResult = await runImprover(config, { sprintId: "manual", title: "Manual improve", acceptanceCriteria: [], implementation: { steps: [], filesToCreate: [], filesToModify: [], validationCommands: [] }, evaluationCriteria: [], negotiationRounds: [] }, [], `Domain: ${impDomain}`);
      const expPath = resolvePath(config.expertise.dir, `${impDomain}.yaml`);
      const { changesApplied } = applyExpertiseUpdate(expPath, impResult, config.expertise.maxLines);
      console.log(`Applied ${changesApplied.length} changes to ${impDomain}.yaml`);
      for (const c of changesApplied) console.log(`  - ${c}`);
      break;
    }
    case "create": {
      const newDomain = args.positional[1];
      if (!newDomain) { console.error("Usage: shipwright expertise create <domain>"); process.exit(1); }
      const { resolve: resolvePath2 } = await import("path");
      const { copyFileSync, existsSync } = await import("fs");
      const targetPath = resolvePath2(config.expertise.dir, `${newDomain}.yaml`);
      if (existsSync(targetPath)) { console.error(`Already exists: ${targetPath}`); process.exit(1); }
      const templatePath = resolvePath2(config.expertise.dir, "_template.yaml");
      if (!existsSync(templatePath)) { console.error("Template not found: expertise/_template.yaml"); process.exit(1); }
      copyFileSync(templatePath, targetPath);
      console.log(`Created expertise file: ${targetPath}`);
      console.log(`Edit the file, then run: shipwright expertise improve ${newDomain}`);
      break;
    }
    case "question": {
      const qDomain = args.positional[1];
      const question = args.positional.slice(2).join(" ");
      if (!qDomain || !question) { console.error("Usage: shipwright expertise question <domain> <question>"); process.exit(1); }
      const qCtx = loadExpertise(config.expertise.dir);
      const qFile = qCtx.files.find((f) => f.domain === qDomain);
      if (!qFile) { console.error(`Expertise file not found: ${qDomain}`); process.exit(1); }
      const { formatExpertiseForPrompt } = await import("./expertise/loader.js");
      console.log(`\n⚓ Answering from ${qDomain} expertise:\n`);
      console.log(formatExpertiseForPrompt({ files: [qFile], totalLines: qFile.lineCount }));
      console.log(`\nTo get AI-powered answers, use the full pipeline or Claude Code with this expertise as context.`);
      break;
    }
    default:
      console.error(`Unknown expertise command: ${subcmd}`);
      console.error("Available: list, validate, improve, create, question");
      process.exit(1);
  }
}

async function showStatus(): Promise<void> {
  const statePath = ".shipwright/state.json";
  if (!fileExists(statePath)) {
    console.log("No active pipeline. Run `shipwright build <prd>` to start.");
    return;
  }

  const state = readJsonFile<PipelineState>(statePath);
  if (!state) {
    console.log("Could not read pipeline state.");
    return;
  }

  console.log(`\n⚓ Pipeline Status`);
  console.log(`   PRD: ${state.prdPath}`);
  console.log(`   Phase: ${state.phase}`);
  console.log(`   Sprint: ${state.currentSprintIndex + 1}/${state.sprints.length}`);
  console.log(`   Attempt: ${state.currentAttempt}`);
  console.log(`   Started: ${state.startedAt}`);
  console.log(`   Updated: ${state.updatedAt}`);
  console.log(`   Cost: $${state.totalCostUsd.toFixed(4)}\n`);

  for (const sprint of state.sprints) {
    const emoji = sprint.status === "passed" ? "✅" : sprint.status === "failed" ? "❌" : sprint.status === "in_progress" ? "🔄" : "⏳";
    console.log(`   ${emoji} ${sprint.plan.title} — ${sprint.status} (${sprint.attempts.length} attempts)`);
  }
  console.log("");
}

async function resumePipeline(): Promise<void> {
  const statePath = ".shipwright/state.json";
  if (!fileExists(statePath)) {
    console.log("No pipeline state to resume. Run `shipwright build <prd>` first.");
    return;
  }

  const state = readJsonFile<PipelineState>(statePath);
  if (!state) {
    console.log("Could not read pipeline state.");
    return;
  }

  if (state.phase === "complete") {
    console.log("Pipeline already completed successfully. Nothing to resume.");
    return;
  }

  // Handle decision resume
  if (state.phase === "awaiting_decision") {
    const { readDecisionAnswer } = await import("./pipeline/decisions.js");
    const answer = readDecisionAnswer(".shipwright");
    if (!answer || !answer.answer) {
      console.log("\n⚓ Pipeline is awaiting a decision.\n");
      console.log("  Edit .shipwright/decisions-pending.json with your answer.");
      console.log("  Then run: shipwright resume\n");

      if (fileExists(".shipwright/DECISION-REQUIRED.md")) {
        const md = readText(".shipwright/DECISION-REQUIRED.md");
        console.log(md);
      }
      return;
    }
    console.log(`\n⚓ Decision answer: ${answer.answer}`);
    console.log(`  Injecting into sprint context and resuming...\n`);
  }

  console.log(`\n⚓ Resuming pipeline from sprint ${state.currentSprintIndex + 1}...`);
  console.log(`   PRD: ${state.prdPath}`);
  console.log(`   Phase: ${state.phase}`);
  console.log(`   Sprint: ${state.currentSprintIndex + 1}/${state.sprints.length}\n`);

  const config = loadConfig();

  // Resume from the failed/in-progress sprint
  const result = await runPipeline(config, state.prdPath, {
    sprintFilter: state.currentSprintIndex + 1,
  });

  process.exit(result.status === "complete" ? 0 : result.status === "awaiting_decision" ? 2 : 1);
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
