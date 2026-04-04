/**
 * Validation Cache — skip re-validating PRDs that haven't changed
 *
 * Stores SHA-256 hash of PRD content + validation result + timestamp.
 * Cache hit = same hash + entry < 7 days old.
 * After 3 validation passes on a PRD, criticals are downgraded to warnings.
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { readJsonFile, writeJsonFile, fileExists } from "../lib/fs.js";

export interface ValidationCacheEntry {
  contentHash: string;
  verdict: "PASS" | "REVIEW" | "BLOCK";
  critical: number;
  warning: number;
  info: number;
  passCount: number;
  validatedAt: string;
  reportPath?: string;
}

export interface ValidationCache {
  entries: Record<string, ValidationCacheEntry>;
}

const CACHE_FILE = "validation-cache.json";
const MAX_AGE_DAYS = 7;
const DEFAULT_MAX_PASSES = 3;

export function hashPrd(prdPath: string): string {
  const content = readFileSync(resolve(prdPath), "utf-8");
  const hash = createHash("sha256").update(content).digest("hex");
  return `sha256:${hash}`;
}

export function readCache(stateDir: string): ValidationCache {
  const cachePath = resolve(stateDir, CACHE_FILE);
  if (!fileExists(cachePath)) {
    return { entries: {} };
  }
  const data = readJsonFile<ValidationCache>(cachePath);
  return data ?? { entries: {} };
}

export function writeCache(stateDir: string, cache: ValidationCache): void {
  const cachePath = resolve(stateDir, CACHE_FILE);
  writeJsonFile(cachePath, cache);
}

export function isCacheValid(
  cache: ValidationCache,
  prdPath: string,
  currentHash: string,
  maxAgeDays: number = MAX_AGE_DAYS
): boolean {
  const entry = cache.entries[prdPath];
  if (!entry) return false;

  // Hash mismatch — PRD content changed
  if (entry.contentHash !== currentHash) return false;

  // Age check — re-validate if older than maxAgeDays
  const validatedAt = new Date(entry.validatedAt).getTime();
  const now = Date.now();
  const ageDays = (now - validatedAt) / (1000 * 60 * 60 * 24);
  if (ageDays > maxAgeDays) return false;

  // Only cache hits for PASS or REVIEW — BLOCK entries are not "valid" cache hits
  // (we want to re-validate blocked PRDs unless pass count logic handles it)
  if (entry.verdict === "BLOCK") return false;

  return true;
}

export function getPassCount(cache: ValidationCache, prdPath: string): number {
  return cache.entries[prdPath]?.passCount ?? 0;
}

export function shouldDowngradeCriticals(
  cache: ValidationCache,
  prdPath: string,
  maxPasses: number = DEFAULT_MAX_PASSES
): boolean {
  const passCount = getPassCount(cache, prdPath);
  return passCount >= maxPasses;
}

export function updateCache(
  cache: ValidationCache,
  prdPath: string,
  contentHash: string,
  verdict: "PASS" | "REVIEW" | "BLOCK",
  counts: { critical: number; warning: number; info: number },
  reportPath?: string
): void {
  const existing = cache.entries[prdPath];

  // Increment pass count if hash matches (same PRD content), otherwise reset
  const passCount =
    existing && existing.contentHash === contentHash
      ? existing.passCount + 1
      : 1;

  cache.entries[prdPath] = {
    contentHash,
    verdict,
    critical: counts.critical,
    warning: counts.warning,
    info: counts.info,
    passCount,
    validatedAt: new Date().toISOString(),
    reportPath,
  };
}
