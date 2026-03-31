/**
 * Expertise Updater — merges learnings from successful sprints into YAML files
 */

import { resolve } from "path";
import { stringify } from "yaml";
import { parseYamlFile, countYamlLines } from "../lib/yaml.js";
import { writeText, fileExists } from "../lib/fs.js";
import type { ExpertiseContent, ExpertiseUpdate, ExpertisePattern, ExpertiseGotcha, ExpertiseDecision } from "./types.js";

/**
 * Apply an update to an expertise YAML file.
 * Creates the file from template if it doesn't exist.
 */
export function applyExpertiseUpdate(
  filePath: string,
  update: ExpertiseUpdate,
  maxLines: number = 1000
): { applied: boolean; changesApplied: string[] } {
  const changes: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  let content: ExpertiseContent;
  if (fileExists(filePath)) {
    content = parseYamlFile<ExpertiseContent>(filePath);
  } else {
    content = createEmptyExpertise(update.domain);
  }

  // Apply new patterns
  for (const pattern of update.newPatterns) {
    const exists = content.patterns?.some(
      (p) => p.name.toLowerCase() === pattern.name.toLowerCase()
    );
    if (!exists) {
      const newPattern: ExpertisePattern = {
        ...pattern,
        added_date: now,
      };
      content.patterns = content.patterns ?? [];
      content.patterns.push(newPattern);
      changes.push(`Added pattern: ${pattern.name}`);
    }
  }

  // Apply new gotchas
  for (const gotcha of update.newGotchas) {
    const exists = content.gotchas?.some(
      (g) => g.description.toLowerCase() === gotcha.description.toLowerCase()
    );
    if (!exists) {
      const newGotcha: ExpertiseGotcha = {
        ...gotcha,
        added_date: now,
      };
      content.gotchas = content.gotchas ?? [];
      content.gotchas.push(newGotcha);
      changes.push(`Added gotcha: ${gotcha.description.slice(0, 60)}`);
    }
  }

  // Apply new decisions
  for (const decision of update.newDecisions) {
    const exists = content.decisions?.some(
      (d) => d.decision.toLowerCase() === decision.decision.toLowerCase()
    );
    if (!exists) {
      const newDecision: ExpertiseDecision = {
        ...decision,
        added_date: now,
      };
      content.decisions = content.decisions ?? [];
      content.decisions.push(newDecision);
      changes.push(`Added decision: ${decision.decision.slice(0, 60)}`);
    }
  }

  // Apply corrections
  for (const correction of update.corrections) {
    changes.push(`Corrected: ${correction.path}`);
    // Simple nested path correction (e.g., "overview.description")
    const parts = correction.path.split(".");
    let target: Record<string, unknown> = content as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      target = (target[parts[i]] ?? {}) as Record<string, unknown>;
    }
    const lastKey = parts[parts.length - 1];
    if (lastKey && target[lastKey] === correction.oldValue) {
      target[lastKey] = correction.newValue;
    }
  }

  // Update metadata
  content.metadata = content.metadata ?? {
    created: now,
    last_validated: now,
    source_sprints: [],
    stability: "evolving",
    consecutive_no_change: 0,
  };
  content.metadata.last_validated = now;

  if (changes.length > 0) {
    content.metadata.consecutive_no_change = 0;
    content.metadata.stability = "evolving";
  } else {
    content.metadata.consecutive_no_change =
      (content.metadata.consecutive_no_change ?? 0) + 1;
    if (content.metadata.consecutive_no_change >= 3) {
      content.metadata.stability = "stable";
    }
  }

  // Write and enforce line limit
  let yaml = stringify(content, { lineWidth: 120 });
  const lineCount = yaml.split("\n").length;

  if (lineCount > maxLines) {
    // Trim least critical items (oldest patterns, low-impact gotchas)
    content.patterns = (content.patterns ?? []).slice(-15); // Keep newest 15
    content.anti_patterns = (content.anti_patterns ?? []).slice(-5);
    yaml = stringify(content, { lineWidth: 120 });
    changes.push(`Trimmed to stay under ${maxLines} lines`);
  }

  writeText(filePath, yaml);

  return { applied: changes.length > 0, changesApplied: changes };
}

function createEmptyExpertise(domain: string): ExpertiseContent {
  return {
    overview: {
      description: `Expertise for ${domain}`,
      scope: [],
      key_files: [],
    },
    core_implementation: {},
    patterns: [],
    gotchas: [],
    decisions: [],
    anti_patterns: [],
    metadata: {
      created: new Date().toISOString().split("T")[0],
      last_validated: new Date().toISOString().split("T")[0],
      source_sprints: [],
      stability: "evolving",
      consecutive_no_change: 0,
    },
  };
}
