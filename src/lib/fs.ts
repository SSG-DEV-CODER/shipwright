/**
 * File system helpers
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function readText(filePath: string): string {
  return readFileSync(resolve(filePath), "utf-8");
}

export function writeText(filePath: string, content: string): void {
  const dir = dirname(filePath);
  ensureDir(dir);
  writeFileSync(resolve(filePath), content, "utf-8");
}

export function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = readText(filePath);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  writeText(filePath, JSON.stringify(data, null, 2) + "\n");
}

export function fileExists(filePath: string): boolean {
  return existsSync(resolve(filePath));
}
