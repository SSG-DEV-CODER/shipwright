/**
 * Scout Agent — parallel read-only codebase exploration
 *
 * Scouts explore specific directories or file patterns before the Planner
 * creates a sprint plan. Multiple scouts run in parallel, each focused on
 * a different area.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { runAgent, AGENT_TOOLS, type AgentRole } from "./base.js";
import { extractJson } from "../lib/json-extract.js";
import type { ShipwrightConfig } from "../config.js";
import type { ScoutReport } from "../pipeline/types.js";
import type { SprintPlan } from "../intake/types.js";

const SCOUT_ROLE: AgentRole = "scout";

interface ScoutDirection {
  id: string;
  targetDir: string;
  focus: string;
  prompt: string;
}

/**
 * Run parallel scout agents to explore relevant parts of the codebase.
 */
export async function runScouts(
  config: ShipwrightConfig,
  sprint: SprintPlan,
  referenceContext: string
): Promise<ScoutReport[]> {
  const directions = assignScoutDirections(config, sprint);

  // Load system prompt
  const systemPrompt = loadPromptFile("scout.md");

  // Run scouts in parallel
  const results = await Promise.all(
    directions.map(async (dir) => {
      const userPrompt = buildScoutUserPrompt(dir, sprint, referenceContext);

      const result = await runAgent({
        role: SCOUT_ROLE,
        systemPrompt,
        userPrompt,
        tools: AGENT_TOOLS[SCOUT_ROLE],
        model: config.models.scout,
        maxTurns: 15,
        workingDir: dir.targetDir,
      });

      const findings = extractJson<ScoutReport["findings"]>(
        result.output,
        ["relevantFiles", "patterns"],
        {
          relevantFiles: [],
          patterns: [],
          dependencies: [],
          potentialIssues: [],
        }
      );

      return {
        scoutId: dir.id,
        targetDir: dir.targetDir,
        focus: dir.focus,
        findings,
        durationMs: result.durationMs,
      } satisfies ScoutReport;
    })
  );

  return results;
}

/**
 * Assign scout directions based on sprint context and config.
 */
function assignScoutDirections(
  config: ShipwrightConfig,
  sprint: SprintPlan
): ScoutDirection[] {
  const directions: ScoutDirection[] = [];
  let counter = 1;

  // Scout the target directory
  directions.push({
    id: `scout-${counter++}`,
    targetDir: resolve(config.target.dir),
    focus: "Target codebase structure and existing patterns",
    prompt: `Explore the target codebase. Focus on: ${sprint.title}. Look for existing patterns, conventions, and relevant files.`,
  });

  // Scout each reference codebase
  for (const ref of config.references.slice(0, config.pipeline.maxScouts - 1)) {
    directions.push({
      id: `scout-${counter++}`,
      targetDir: resolve(ref.path),
      focus: `Reference: ${ref.label}`,
      prompt: `Explore this reference codebase (${ref.label}). Find patterns, implementations, and code relevant to: ${sprint.title}`,
    });
  }

  // Scout specific file targets from the sprint
  if (sprint.fileTargets.length > 0 && directions.length < config.pipeline.maxScouts) {
    const targetDirs = [...new Set(
      sprint.fileTargets
        .map((f) => f.split("/").slice(0, -1).join("/"))
        .filter(Boolean)
    )];

    for (const dir of targetDirs.slice(0, config.pipeline.maxScouts - directions.length)) {
      directions.push({
        id: `scout-${counter++}`,
        targetDir: resolve(config.target.dir, dir),
        focus: `Sprint file targets in ${dir}/`,
        prompt: `Explore this directory deeply. The sprint will create/modify files here. Report existing files, patterns, and dependencies.`,
      });
    }
  }

  return directions.slice(0, config.pipeline.maxScouts);
}

function buildScoutUserPrompt(
  direction: ScoutDirection,
  sprint: SprintPlan,
  referenceContext: string
): string {
  const parts: string[] = [
    `## Sprint Context`,
    `Title: ${sprint.title}`,
    `Description: ${sprint.description}`,
    "",
    `## Your Focus`,
    direction.prompt,
    "",
  ];

  if (sprint.fileTargets.length > 0) {
    parts.push(`## Expected File Targets`);
    for (const f of sprint.fileTargets) {
      parts.push(`- ${f}`);
    }
    parts.push("");
  }

  if (sprint.acceptanceCriteria.length > 0) {
    parts.push(`## Acceptance Criteria`);
    for (const c of sprint.acceptanceCriteria) {
      parts.push(`- ${c.text}`);
    }
    parts.push("");
  }

  if (referenceContext) {
    parts.push(`## Reference Context`, referenceContext, "");
  }

  parts.push(
    "Explore the codebase and produce your report as JSON with: relevantFiles, patterns, dependencies, potentialIssues."
  );

  return parts.join("\n");
}

function loadPromptFile(filename: string): string {
  const promptPath = resolve(import.meta.dir, "../prompts", filename);
  try {
    return readFileSync(promptPath, "utf-8");
  } catch {
    return `You are a ${filename.replace(".md", "")} agent. Follow your assigned task.`;
  }
}

/**
 * Format scout reports for injection into planner/generator prompts.
 */
export function formatScoutReports(reports: ScoutReport[]): string {
  if (reports.length === 0) return "";

  const parts: string[] = ["## Scout Reports\n"];

  for (const report of reports) {
    parts.push(`### ${report.focus} (${report.durationMs}ms)`);

    if (report.findings.relevantFiles.length > 0) {
      parts.push("**Relevant files:**");
      for (const f of report.findings.relevantFiles.slice(0, 20)) {
        parts.push(`- ${f}`);
      }
    }

    if (report.findings.patterns.length > 0) {
      parts.push("**Patterns:**");
      for (const p of report.findings.patterns) {
        parts.push(`- ${p}`);
      }
    }

    if (report.findings.dependencies.length > 0) {
      parts.push("**Dependencies:**");
      for (const d of report.findings.dependencies) {
        parts.push(`- ${d}`);
      }
    }

    if (report.findings.potentialIssues.length > 0) {
      parts.push("**Potential issues:**");
      for (const i of report.findings.potentialIssues) {
        parts.push(`- ${i}`);
      }
    }

    parts.push("");
  }

  return parts.join("\n");
}
