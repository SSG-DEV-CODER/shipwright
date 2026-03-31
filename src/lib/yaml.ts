/**
 * YAML parse/serialize helpers
 */

import { parse, stringify } from "yaml";
import { readText, writeText } from "./fs.js";

export function parseYamlFile<T>(filePath: string): T {
  const raw = readText(filePath);
  return parse(raw) as T;
}

export function writeYamlFile(filePath: string, data: unknown): void {
  const content = stringify(data, { lineWidth: 120 });
  writeText(filePath, content);
}

export function validateYaml(content: string): { valid: boolean; error?: string } {
  try {
    parse(content);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

export function countYamlLines(filePath: string): number {
  const content = readText(filePath);
  return content.split("\n").length;
}
