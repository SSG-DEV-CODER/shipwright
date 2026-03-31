/**
 * Expertise Loader — reads and parses YAML expertise files
 */

import { readdirSync } from "fs";
import { resolve, basename } from "path";
import { parseYamlFile, countYamlLines } from "../lib/yaml.js";
import { fileExists } from "../lib/fs.js";
import type { ExpertiseFile, ExpertiseContent, ExpertiseContext } from "./types.js";

export function loadExpertise(expertiseDir: string): ExpertiseContext {
  const dir = resolve(expertiseDir);
  if (!fileExists(dir)) {
    return { files: [], totalLines: 0 };
  }

  const yamlFiles = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") && !f.startsWith("_"))
    .sort();

  const files: ExpertiseFile[] = [];
  let totalLines = 0;

  for (const file of yamlFiles) {
    const filePath = resolve(dir, file);
    try {
      const content = parseYamlFile<ExpertiseContent>(filePath);
      const lineCount = countYamlLines(filePath);
      totalLines += lineCount;

      files.push({
        domain: basename(file, ".yaml"),
        filePath,
        lineCount,
        lastUpdated: content.metadata?.last_validated ?? "unknown",
        content,
      });
    } catch (err) {
      console.warn(`Warning: Failed to parse expertise file ${file}: ${err}`);
    }
  }

  return { files, totalLines };
}

/**
 * Format expertise for injection into agent system prompts.
 * Returns a condensed text representation.
 */
export function formatExpertiseForPrompt(
  context: ExpertiseContext,
  maxChars: number = 8000
): string {
  if (context.files.length === 0) return "";

  const parts: string[] = ["## Domain Expertise\n"];
  let currentLength = parts[0].length;

  for (const file of context.files) {
    const section = formatExpertiseFile(file);
    if (currentLength + section.length > maxChars) break;
    parts.push(section);
    currentLength += section.length;
  }

  return parts.join("\n");
}

function formatExpertiseFile(file: ExpertiseFile): string {
  const c = file.content;
  const lines: string[] = [
    `### ${file.domain} (${file.lineCount} lines)`,
    "",
    c.overview?.description ?? "",
    "",
  ];

  // Key files
  if (c.overview?.key_files?.length) {
    lines.push("**Key files:** " + c.overview.key_files.join(", "));
  }

  // Patterns (top 5)
  if (c.patterns?.length) {
    lines.push("\n**Patterns:**");
    for (const p of c.patterns.slice(0, 5)) {
      lines.push(`- ${p.name}: ${p.description}`);
    }
  }

  // Gotchas (all — these are critical)
  if (c.gotchas?.length) {
    lines.push("\n**Gotchas:**");
    for (const g of c.gotchas) {
      lines.push(`- [${g.impact}] ${g.description} → ${g.mitigation}`);
    }
  }

  // Anti-patterns
  if (c.anti_patterns?.length) {
    lines.push("\n**Anti-patterns:**");
    for (const ap of c.anti_patterns.slice(0, 3)) {
      lines.push(`- ${ap}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Get expertise domains relevant to a set of file targets.
 */
export function findRelevantExpertise(
  context: ExpertiseContext,
  fileTargets: string[]
): ExpertiseFile[] {
  if (context.files.length === 0 || fileTargets.length === 0) {
    return context.files; // Return all if no filter
  }

  return context.files.filter((file) => {
    const keyFiles = file.content.overview?.key_files ?? [];
    const scope = file.content.overview?.scope ?? [];

    // Check if any file targets overlap with expertise key files or scope
    return fileTargets.some((target) => {
      return (
        keyFiles.some((kf) => target.includes(kf) || kf.includes(target)) ||
        scope.some((s) => target.toLowerCase().includes(s.toLowerCase()))
      );
    });
  });
}
