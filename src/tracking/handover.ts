/**
 * Handover Report Generator — template-driven, no AI tokens needed.
 *
 * Generates HANDOVER.md in the target workspace after a successful build.
 * Contains: access URLs, credentials, directory structure, commands,
 * build summary, and orientation guide.
 */

import { resolve, relative } from "path";
import { readdirSync, existsSync, statSync } from "fs";
import { readText, writeText, readJsonFile } from "../lib/fs.js";
import type { CostLedger } from "../lib/cost.js";
import type { ShipwrightConfig } from "../config.js";
import type { PipelineState, PipelineResult } from "../pipeline/types.js";
import type { PRD } from "../intake/types.js";

interface SprintResult {
  sprintId: string;
  status: string;
  attempts: number;
  finalScore: number;
  commitHash?: string;
  costUsd: number;
  durationMs: number;
}

export function generateHandover(
  config: ShipwrightConfig,
  state: PipelineState,
  sprintResults: SprintResult[],
  costLedger: CostLedger,
  prd: PRD,
): void {
  const targetDir = resolve(config.target.dir);
  const lines: string[] = [];

  // --- Header ---
  lines.push(`# Handover Report: ${prd.title}`);
  lines.push(``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Built by: [Shipwright](https://github.com/SSG-DEV-CODER/shipwright) adversarial pipeline`);
  lines.push(``);
  lines.push(`---`);

  // --- Access ---
  lines.push(``);
  lines.push(`## Access`);
  lines.push(``);

  // Try to read template.config.ts for port
  const port = extractPort(targetDir);
  lines.push(`| Service | URL |`);
  lines.push(`|---------|-----|`);
  lines.push(`| Local dev | http://localhost:${port} |`);
  lines.push(`| Payload admin | http://localhost:${port}/admin |`);
  lines.push(`| Supabase dashboard | http://localhost:54323 |`);
  lines.push(`| Supabase API | http://localhost:54321 |`);
  lines.push(``);

  // --- Credentials ---
  lines.push(`## Credentials`);
  lines.push(``);
  const envVars = extractEnvVars(targetDir);
  if (Object.keys(envVars).length > 0) {
    lines.push(`From \`.env\`:`);
    lines.push(`| Variable | Value |`);
    lines.push(`|----------|-------|`);
    for (const [key, value] of Object.entries(envVars)) {
      // Mask sensitive values
      const display = key.includes("SECRET") || key.includes("KEY")
        ? `${value.slice(0, 8)}...`
        : value;
      lines.push(`| ${key} | \`${display}\` |`);
    }
    lines.push(``);
  }

  // Check for seed data (admin user)
  const seedPath = resolve(targetDir, "supabase/seed.sql");
  if (existsSync(seedPath)) {
    const seed = readText(seedPath);
    const emailMatch = seed.match(/email['":\s]+['"]([^'"]+)['"]/i);
    const passMatch = seed.match(/password['":\s]+['"]([^'"]+)['"]/i);
    if (emailMatch) {
      lines.push(`**Admin user** (from seed data):`);
      lines.push(`- Email: \`${emailMatch[1]}\``);
      if (passMatch) lines.push(`- Password: \`${passMatch[1]}\``);
      lines.push(``);
    }
  }

  // --- Commands ---
  lines.push(`## Commands`);
  lines.push(``);
  lines.push(`| Command | Description |`);
  lines.push(`|---------|-------------|`);
  lines.push(`| \`pnpm dev\` | Start development server |`);
  lines.push(`| \`pnpm build\` | Production build |`);
  lines.push(`| \`bunx tsc --noEmit\` | TypeScript type check |`);
  lines.push(`| \`supabase start\` | Start local Supabase |`);
  lines.push(`| \`supabase stop\` | Stop local Supabase |`);
  lines.push(`| \`supabase db reset\` | Reset database (reapply migrations + seed) |`);
  lines.push(``);

  // --- Directory Structure ---
  lines.push(`## Directory Structure`);
  lines.push(``);
  lines.push("```");
  const tree = buildTree(targetDir, "", 3);
  lines.push(tree);
  lines.push("```");
  lines.push(``);

  // --- Route Map ---
  const routes = scanRoutes(targetDir);
  if (routes.length > 0) {
    lines.push(`## Route Map`);
    lines.push(``);
    lines.push(`| Path | Type |`);
    lines.push(`|------|------|`);
    for (const route of routes) {
      lines.push(`| ${route.path} | ${route.type} |`);
    }
    lines.push(``);
  }

  // --- Collections ---
  const collections = scanCollections(targetDir);
  if (collections.length > 0) {
    lines.push(`## Payload Collections`);
    lines.push(``);
    for (const col of collections) {
      lines.push(`- ${col}`);
    }
    lines.push(``);
  }

  // --- Build Summary ---
  lines.push(`## Build Summary`);
  lines.push(``);

  const fmtDur = (ms: number) => {
    if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  };
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  lines.push(`| Sprint | Score | Attempts | Time | Tokens | API Cost |`);
  lines.push(`|--------|-------|----------|------|--------|----------|`);

  let totalTokens = 0;
  let totalApiCost = 0;
  const totalDuration = sprintResults.reduce((s, r) => s + r.durationMs, 0);

  for (const sr of sprintResults) {
    const sprintPlan = state.sprints.find((s) => s.plan.id === sr.sprintId);
    const name = sprintPlan?.plan.title ?? sr.sprintId;
    const score = sr.finalScore > 0 ? `${sr.finalScore}/10` : "—";
    const tokens = costLedger.tokensForSprint(sr.sprintId);
    const apiCost = costLedger.apiCostForSprint(sr.sprintId);
    totalTokens += tokens.total;
    totalApiCost += apiCost;

    const status = sr.status === "passed" ? "✓" : "✗";
    lines.push(`| ${status} ${name} | ${score} | ${sr.attempts} | ${fmtDur(sr.durationMs)} | ${fmtTokens(tokens.total)} | $${apiCost.toFixed(2)} |`);
  }

  lines.push(`| **TOTAL** | **${(sprintResults.reduce((s, r) => s + r.finalScore, 0) / sprintResults.length).toFixed(1)} avg** | **${sprintResults.reduce((s, r) => s + r.attempts, 0)}** | **${fmtDur(totalDuration)}** | **${fmtTokens(totalTokens)}** | **$${totalApiCost.toFixed(2)}** |`);
  lines.push(``);
  lines.push(`> Pricing: Subscription plan (actual cost: $0). API pricing shown for reference.`);
  lines.push(``);

  // --- Known Issues ---
  lines.push(`## Known Issues`);
  lines.push(``);
  lines.push(`- Tailwind CSS global styles may conflict with Payload admin dashboard styling. Scope Tailwind to exclude the (payload) route group.`);
  lines.push(``);

  // --- Git Log ---
  lines.push(`## Git History`);
  lines.push(``);
  try {
    const { execSync } = require("child_process");
    const gitLog = execSync(`git log --oneline -20`, { cwd: targetDir, stdio: "pipe" }).toString().trim();
    lines.push("```");
    lines.push(gitLog);
    lines.push("```");
  } catch {
    lines.push(`_Git log not available._`);
  }
  lines.push(``);

  writeText(resolve(targetDir, "HANDOVER.md"), lines.join("\n"));
}

// --- Helpers ---

function extractPort(targetDir: string): number {
  try {
    const configPath = resolve(targetDir, "src/template.config.ts");
    if (existsSync(configPath)) {
      const content = readText(configPath);
      const portMatch = content.match(/port:\s*(\d+)/);
      if (portMatch) return parseInt(portMatch[1], 10);
    }
  } catch {}
  return 9020;
}

function extractEnvVars(targetDir: string): Record<string, string> {
  const envPath = resolve(targetDir, ".env");
  const vars: Record<string, string> = {};
  if (!existsSync(envPath)) return vars;

  const content = readText(envPath);
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eqIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) vars[key] = value;
  }
  return vars;
}

function buildTree(dir: string, prefix: string, maxDepth: number): string {
  if (maxDepth <= 0) return "";
  const lines: string[] = [];
  const ignore = new Set(["node_modules", ".next", ".git", ".shipwright", "vendor-docs", "bun.lock", "pnpm-lock.yaml"]);

  try {
    const entries = readdirSync(dir).filter((e) => !ignore.has(e) && !e.startsWith(".")).sort();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const fullPath = resolve(dir, entry);
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          lines.push(`${prefix}${connector}${entry}/`);
          const subtree = buildTree(fullPath, prefix + childPrefix, maxDepth - 1);
          if (subtree) lines.push(subtree);
        } else {
          lines.push(`${prefix}${connector}${entry}`);
        }
      } catch {}
    }
  } catch {}
  return lines.join("\n");
}

function scanRoutes(targetDir: string): Array<{ path: string; type: string }> {
  const routes: Array<{ path: string; type: string }> = [];
  const appDir = resolve(targetDir, "src/app");
  if (!existsSync(appDir)) return routes;

  function scan(dir: string, routePath: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = resolve(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          let segment = entry;
          if (entry.startsWith("(") && entry.endsWith(")")) {
            // Route group — doesn't add to URL path
            scan(fullPath, routePath);
            continue;
          }
          if (entry.startsWith("[") && entry.endsWith("]")) {
            segment = `:${entry.slice(1, -1)}`;
          }
          scan(fullPath, `${routePath}/${segment}`);
        } else if (entry === "page.tsx" || entry === "page.ts") {
          routes.push({ path: routePath || "/", type: "Page" });
        } else if (entry === "route.ts" || entry === "route.tsx") {
          routes.push({ path: routePath || "/", type: "API" });
        }
      }
    } catch {}
  }

  scan(appDir, "");
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function scanCollections(targetDir: string): string[] {
  const colDir = resolve(targetDir, "src/collections");
  if (!existsSync(colDir)) return [];

  try {
    return readdirSync(colDir)
      .filter((f) => f.endsWith(".ts") && !f.startsWith("_") && !f.startsWith("index"))
      .map((f) => f.replace(/\.ts$/, ""));
  } catch {
    return [];
  }
}
