/**
 * Configuration loader — reads shipwright.yaml + CLI overrides
 */

import { parse as parseYaml } from "yaml";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export interface ShipwrightConfig {
  target: {
    dir: string;
    language: string;
    runtime: string;
    typecheckCmd: string;
    testCmd: string;
    lintCmd: string;
  };

  models: {
    scout: string;
    planner: string;
    generator: string;
    evaluator: string;
    negotiator: string;
    improver: string;
  };

  pipeline: {
    maxRetries: number;
    maxScouts: number;
    contractRounds: number;
    evalPassThreshold: number;
  };

  expertise: {
    dir: string;
    autoImprove: boolean;
    maxLines: number;
  };

  references: Array<{
    path: string;
    label: string;
  }>;

  tracking: {
    progressFile: string;
    logFile: string;
    gitCommits: boolean;
    commitPrefix: string;
  };

  limits: {
    maxCostPerSprint: number;
    maxCostPerBuild: number;
    maxTokensPerAgentCall: number;
  };
}

const DEFAULT_CONFIG: ShipwrightConfig = {
  target: {
    dir: ".",
    language: "typescript",
    runtime: "bun",
    typecheckCmd: "bunx tsc --noEmit",
    testCmd: "bun test",
    lintCmd: "bunx tsc --noEmit",
  },

  models: {
    scout: "claude-sonnet-4-20250514",
    planner: "claude-opus-4-20250514",
    generator: "claude-opus-4-20250514",
    evaluator: "claude-sonnet-4-20250514",
    negotiator: "claude-opus-4-20250514",
    improver: "claude-sonnet-4-20250514",
  },

  pipeline: {
    maxRetries: 3,
    maxScouts: 5,
    contractRounds: 2,
    evalPassThreshold: 7.0,
  },

  expertise: {
    dir: "./expertise",
    autoImprove: true,
    maxLines: 1000,
  },

  references: [],

  tracking: {
    progressFile: "PROGRESS.md",
    logFile: "LOG.md",
    gitCommits: true,
    commitPrefix: "shipwright:",
  },

  limits: {
    maxCostPerSprint: 5.0,
    maxCostPerBuild: 25.0,
    maxTokensPerAgentCall: 200_000,
  },
};

export function loadConfig(configPath?: string): ShipwrightConfig {
  const resolvedPath = configPath
    ? resolve(configPath)
    : resolve("shipwright.yaml");

  if (!existsSync(resolvedPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(resolvedPath, "utf-8");
  const parsed = parseYaml(raw) as Record<string, unknown>;

  return mergeConfig(DEFAULT_CONFIG, parsed);
}

function mergeConfig(
  defaults: ShipwrightConfig,
  overrides: Record<string, unknown>
): ShipwrightConfig {
  const config = structuredClone(defaults);

  if (overrides.target && typeof overrides.target === "object") {
    Object.assign(config.target, overrides.target);
  }
  if (overrides.models && typeof overrides.models === "object") {
    Object.assign(config.models, overrides.models);
  }
  if (overrides.pipeline && typeof overrides.pipeline === "object") {
    const p = overrides.pipeline as Record<string, unknown>;
    if (p.max_retries !== undefined) config.pipeline.maxRetries = p.max_retries as number;
    if (p.max_scouts !== undefined) config.pipeline.maxScouts = p.max_scouts as number;
    if (p.contract_rounds !== undefined) config.pipeline.contractRounds = p.contract_rounds as number;
    if (p.eval_pass_threshold !== undefined) config.pipeline.evalPassThreshold = p.eval_pass_threshold as number;
  }
  if (overrides.expertise && typeof overrides.expertise === "object") {
    const e = overrides.expertise as Record<string, unknown>;
    if (e.dir !== undefined) config.expertise.dir = e.dir as string;
    if (e.auto_improve !== undefined) config.expertise.autoImprove = e.auto_improve as boolean;
    if (e.max_lines !== undefined) config.expertise.maxLines = e.max_lines as number;
  }
  if (Array.isArray(overrides.references)) {
    config.references = overrides.references as Array<{ path: string; label: string }>;
  }
  if (overrides.tracking && typeof overrides.tracking === "object") {
    const t = overrides.tracking as Record<string, unknown>;
    if (t.progress_file !== undefined) config.tracking.progressFile = t.progress_file as string;
    if (t.log_file !== undefined) config.tracking.logFile = t.log_file as string;
    if (t.git_commits !== undefined) config.tracking.gitCommits = t.git_commits as boolean;
    if (t.commit_prefix !== undefined) config.tracking.commitPrefix = t.commit_prefix as string;
  }
  if (overrides.limits && typeof overrides.limits === "object") {
    const l = overrides.limits as Record<string, unknown>;
    if (l.max_cost_per_sprint !== undefined) config.limits.maxCostPerSprint = l.max_cost_per_sprint as number;
    if (l.max_cost_per_build !== undefined) config.limits.maxCostPerBuild = l.max_cost_per_build as number;
    if (l.max_tokens_per_agent_call !== undefined) config.limits.maxTokensPerAgentCall = l.max_tokens_per_agent_call as number;
  }

  return config;
}

export function applyCliOverrides(
  config: ShipwrightConfig,
  overrides: Record<string, string>
): ShipwrightConfig {
  const c = structuredClone(config);

  if (overrides["target-dir"]) c.target.dir = overrides["target-dir"];
  if (overrides["expertise-dir"]) c.expertise.dir = overrides["expertise-dir"];
  if (overrides["max-retries"]) c.pipeline.maxRetries = parseInt(overrides["max-retries"], 10);

  // Model overrides: --model-override planner=claude-sonnet-4-20250514
  if (overrides["model-override"]) {
    const [role, model] = overrides["model-override"].split("=");
    if (role && model && role in c.models) {
      (c.models as Record<string, string>)[role] = model;
    }
  }

  return c;
}
