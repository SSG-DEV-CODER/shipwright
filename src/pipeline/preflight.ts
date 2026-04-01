/**
 * Pre-flight environment discovery — checks runtime, database, and env setup
 * before the pipeline builds anything.
 *
 * Pure function: reads system state, returns structured report, no side effects.
 * Can be called multiple times safely (e.g., at start and again on INFRA retry).
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export interface CheckResult {
  available: boolean;
  version?: string;
  note?: string;
}

export interface EnvironmentReport {
  timestamp: string;
  targetDir: string;
  runtime: {
    node: CheckResult;
    bun: CheckResult;
    pnpm: CheckResult;
  };
  database: {
    supabaseCli: CheckResult;
    docker: CheckResult;
    dockerRunning: CheckResult;
    postgres: CheckResult;
    psql: CheckResult;
  };
  envFile: {
    exists: boolean;
    path: string;
    vars: Record<string, CheckResult>;
  };
  summary: string;
}

const DEFAULT_REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "PAYLOAD_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
];

function checkCommand(cmd: string): CheckResult {
  try {
    const output = execSync(cmd, { stdio: "pipe", timeout: 5000 })
      .toString()
      .trim();
    // Extract version-like string from output
    const versionMatch = output.match(/(\d+\.\d+[\.\d]*)/);
    return {
      available: true,
      version: versionMatch ? versionMatch[1] : output.slice(0, 50),
    };
  } catch {
    return { available: false };
  }
}

function checkEnvVars(
  envPath: string,
  requiredVars: string[],
): Record<string, CheckResult> {
  const result: Record<string, CheckResult> = {};

  if (!existsSync(envPath)) {
    for (const v of requiredVars) {
      result[v] = { available: false, note: ".env file not found" };
    }
    return result;
  }

  const content = readFileSync(envPath, "utf-8");
  const lines = content.split("\n");
  const defined = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const key = trimmed.split("=")[0].trim();
    if (key) defined.add(key);
  }

  for (const v of requiredVars) {
    if (defined.has(v)) {
      result[v] = { available: true };
    } else {
      result[v] = { available: false, note: `Not defined in .env` };
    }
  }

  return result;
}

export function runPreflight(
  targetDir: string,
  requiredEnvVars?: string[],
): EnvironmentReport {
  const vars = requiredEnvVars ?? DEFAULT_REQUIRED_ENV_VARS;
  const envPath = resolve(targetDir, ".env");

  const runtime = {
    node: checkCommand("node --version"),
    bun: checkCommand("bun --version"),
    pnpm: checkCommand("pnpm --version"),
  };

  const database = {
    supabaseCli: checkCommand("supabase --version"),
    docker: checkCommand("docker --version"),
    dockerRunning: checkCommand("docker info --format '{{.ServerVersion}}'"),
    postgres: checkCommand("pg_isready -h 127.0.0.1 -p 54322"),
    psql: checkCommand("psql --version"),
  };

  // Adjust postgres note based on result
  if (!database.postgres.available) {
    database.postgres.note = "No PostgreSQL running on localhost:54322 (Supabase default port)";
  }

  const envFile = {
    exists: existsSync(envPath),
    path: envPath,
    vars: checkEnvVars(envPath, vars),
  };

  const summary = formatPreflightOneLiner({ timestamp: "", targetDir, runtime, database, envFile, summary: "" });

  return {
    timestamp: new Date().toISOString(),
    targetDir,
    runtime,
    database,
    envFile,
    summary,
  };
}

export function formatPreflightOneLiner(report: EnvironmentReport): string {
  const parts: string[] = [];

  const check = (label: string, r: CheckResult) => {
    parts.push(r.available ? `${label} ${r.version ?? "OK"}` : `${label} MISSING`);
  };

  check("Bun", report.runtime.bun);
  check("Docker", report.database.docker);
  check("Docker-running", report.database.dockerRunning);
  check("Supabase-CLI", report.database.supabaseCli);
  check("Postgres", report.database.postgres);
  parts.push(report.envFile.exists ? ".env OK" : ".env MISSING");

  const missingVars = Object.entries(report.envFile.vars)
    .filter(([, v]) => !v.available)
    .map(([k]) => k);
  if (missingVars.length > 0) {
    parts.push(`Missing vars: ${missingVars.join(", ")}`);
  }

  return parts.join(" | ");
}

export function formatPreflightForPrompt(report: EnvironmentReport): string {
  const lines: string[] = [
    `## Environment Discovery (${report.timestamp})`,
    ``,
    `### Runtime`,
  ];

  const status = (r: CheckResult) =>
    r.available ? `✓ ${r.version ?? "available"}` : `✗ MISSING${r.note ? ` (${r.note})` : ""}`;

  lines.push(`- Node: ${status(report.runtime.node)}`);
  lines.push(`- Bun: ${status(report.runtime.bun)}`);
  lines.push(`- pnpm: ${status(report.runtime.pnpm)}`);

  lines.push(``, `### Database`);
  lines.push(`- Supabase CLI: ${status(report.database.supabaseCli)}`);
  lines.push(`- Docker: ${status(report.database.docker)}`);
  lines.push(`- Docker running: ${status(report.database.dockerRunning)}`);
  lines.push(`- PostgreSQL (localhost:54322): ${status(report.database.postgres)}`);
  lines.push(`- psql client: ${status(report.database.psql)}`);

  lines.push(``, `### Environment File`);
  lines.push(`- .env: ${report.envFile.exists ? "✓ exists" : "✗ MISSING"} (${report.envFile.path})`);

  if (Object.keys(report.envFile.vars).length > 0) {
    lines.push(`- Variables:`);
    for (const [key, check] of Object.entries(report.envFile.vars)) {
      lines.push(`  - ${key}: ${status(check)}`);
    }
  }

  const missing = [
    ...(!report.database.dockerRunning.available ? ["Docker not running"] : []),
    ...(!report.database.postgres.available ? ["PostgreSQL not running on port 54322"] : []),
    ...(!report.envFile.exists ? [".env file missing"] : []),
    ...Object.entries(report.envFile.vars)
      .filter(([, v]) => !v.available)
      .map(([k]) => `${k} not set`),
  ];

  if (missing.length > 0) {
    lines.push(``, `### ⚠ Issues to Address`);
    for (const m of missing) {
      lines.push(`- ${m}`);
    }
  }

  return lines.join("\n");
}
