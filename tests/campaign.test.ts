import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve } from "path";
import {
  hashPrd,
  readCache,
  writeCache,
  isCacheValid,
  shouldDowngradeCriticals,
  updateCache,
  getPassCount,
} from "../src/pipeline/validation-cache.js";
import { loadManifest } from "../src/campaign/manifest.js";
import type { ValidationCache } from "../src/pipeline/validation-cache.js";

const TEST_DIR = resolve(import.meta.dir, "../.test-tmp-campaign");
const STATE_DIR = resolve(TEST_DIR, ".shipwright");
const PRDS_DIR = resolve(TEST_DIR, "prds");

const SAMPLE_PRD_1 = `# PRD: Phase 1
## Summary
Phase 1 description.
## Acceptance Criteria
- [ ] Works
`;

const SAMPLE_PRD_2 = `# PRD: Phase 2
## Summary
Phase 2 description.
## Acceptance Criteria
- [ ] Also works
`;

beforeAll(() => {
  mkdirSync(PRDS_DIR, { recursive: true });
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(resolve(PRDS_DIR, "PRD-phase-1.md"), SAMPLE_PRD_1);
  writeFileSync(resolve(PRDS_DIR, "PRD-phase-2.md"), SAMPLE_PRD_2);
});

afterAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// --- Validation Cache ---

describe("validation-cache", () => {
  beforeEach(() => {
    // Clear cache between tests
    const cachePath = resolve(STATE_DIR, "validation-cache.json");
    if (existsSync(cachePath)) {
      rmSync(cachePath);
    }
  });

  test("hashPrd returns consistent sha256 hash", () => {
    const prdPath = resolve(PRDS_DIR, "PRD-phase-1.md");
    const hash1 = hashPrd(prdPath);
    const hash2 = hashPrd(prdPath);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("different files produce different hashes", () => {
    const hash1 = hashPrd(resolve(PRDS_DIR, "PRD-phase-1.md"));
    const hash2 = hashPrd(resolve(PRDS_DIR, "PRD-phase-2.md"));
    expect(hash1).not.toBe(hash2);
  });

  test("readCache returns empty cache when no file exists", () => {
    const cache = readCache(STATE_DIR);
    expect(cache).toEqual({ entries: {} });
  });

  test("writeCache and readCache round-trip", () => {
    const cache: ValidationCache = {
      entries: {
        "test.md": {
          contentHash: "sha256:abc123",
          verdict: "PASS",
          critical: 0,
          warning: 1,
          info: 2,
          passCount: 1,
          validatedAt: new Date().toISOString(),
        },
      },
    };
    writeCache(STATE_DIR, cache);
    const loaded = readCache(STATE_DIR);
    expect(loaded.entries["test.md"].verdict).toBe("PASS");
    expect(loaded.entries["test.md"].passCount).toBe(1);
  });

  test("isCacheValid returns true for matching hash within TTL", () => {
    const cache: ValidationCache = { entries: {} };
    updateCache(cache, "test.md", "sha256:abc", "PASS", { critical: 0, warning: 0, info: 0 });
    expect(isCacheValid(cache, "test.md", "sha256:abc")).toBe(true);
  });

  test("isCacheValid returns false for hash mismatch", () => {
    const cache: ValidationCache = { entries: {} };
    updateCache(cache, "test.md", "sha256:abc", "PASS", { critical: 0, warning: 0, info: 0 });
    expect(isCacheValid(cache, "test.md", "sha256:different")).toBe(false);
  });

  test("isCacheValid returns false for expired entry", () => {
    const cache: ValidationCache = {
      entries: {
        "test.md": {
          contentHash: "sha256:abc",
          verdict: "PASS",
          critical: 0,
          warning: 0,
          info: 0,
          passCount: 1,
          validatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        },
      },
    };
    expect(isCacheValid(cache, "test.md", "sha256:abc")).toBe(false);
  });

  test("isCacheValid returns false for BLOCK verdict", () => {
    const cache: ValidationCache = { entries: {} };
    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 2, warning: 0, info: 0 });
    expect(isCacheValid(cache, "test.md", "sha256:abc")).toBe(false);
  });

  test("isCacheValid returns false for missing entry", () => {
    const cache: ValidationCache = { entries: {} };
    expect(isCacheValid(cache, "nonexistent.md", "sha256:abc")).toBe(false);
  });

  test("updateCache increments passCount for same hash", () => {
    const cache: ValidationCache = { entries: {} };
    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    expect(getPassCount(cache, "test.md")).toBe(1);

    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    expect(getPassCount(cache, "test.md")).toBe(2);

    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    expect(getPassCount(cache, "test.md")).toBe(3);
  });

  test("updateCache resets passCount for different hash", () => {
    const cache: ValidationCache = { entries: {} };
    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    expect(getPassCount(cache, "test.md")).toBe(2);

    // Different hash resets
    updateCache(cache, "test.md", "sha256:xyz", "BLOCK", { critical: 1, warning: 0, info: 0 });
    expect(getPassCount(cache, "test.md")).toBe(1);
  });

  test("shouldDowngradeCriticals returns true after 3 passes", () => {
    const cache: ValidationCache = { entries: {} };
    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    expect(shouldDowngradeCriticals(cache, "test.md")).toBe(false);

    updateCache(cache, "test.md", "sha256:abc", "BLOCK", { critical: 1, warning: 0, info: 0 });
    expect(shouldDowngradeCriticals(cache, "test.md")).toBe(true);
  });

  test("shouldDowngradeCriticals returns false for unknown PRD", () => {
    const cache: ValidationCache = { entries: {} };
    expect(shouldDowngradeCriticals(cache, "unknown.md")).toBe(false);
  });
});

// --- Campaign Manifest ---

describe("campaign manifest", () => {
  const MANIFEST_DIR = resolve(TEST_DIR, "builds");
  const CONFIG_PATH = resolve(TEST_DIR, "shipwright.yaml");

  beforeAll(() => {
    mkdirSync(MANIFEST_DIR, { recursive: true });
    // Create a minimal config
    writeFileSync(CONFIG_PATH, "target:\n  dir: .\n");
  });

  test("loadManifest parses valid manifest", () => {
    const manifestPath = resolve(MANIFEST_DIR, "valid.yaml");
    writeFileSync(
      manifestPath,
      `config: ../shipwright.yaml\nphases:\n  - prd: ../prds/PRD-phase-1.md\n    label: "Phase 1"\n  - prd: ../prds/PRD-phase-2.md\n    label: "Phase 2"\n`
    );

    const manifest = loadManifest(manifestPath);
    expect(manifest.phases).toHaveLength(2);
    expect(manifest.phases[0].label).toBe("Phase 1");
    expect(manifest.phases[1].label).toBe("Phase 2");
    expect(manifest.config).toBe(CONFIG_PATH);
  });

  test("loadManifest throws on missing file", () => {
    expect(() => loadManifest(resolve(MANIFEST_DIR, "nonexistent.yaml"))).toThrow("not found");
  });

  test("loadManifest throws on empty phases", () => {
    const manifestPath = resolve(MANIFEST_DIR, "empty-phases.yaml");
    writeFileSync(manifestPath, `config: ../shipwright.yaml\nphases: []\n`);
    expect(() => loadManifest(manifestPath)).toThrow("at least one phase");
  });

  test("loadManifest throws on missing PRD path", () => {
    const manifestPath = resolve(MANIFEST_DIR, "bad-prd.yaml");
    writeFileSync(
      manifestPath,
      `config: ../shipwright.yaml\nphases:\n  - prd: ../prds/nonexistent.md\n    label: "Bad"\n`
    );
    expect(() => loadManifest(manifestPath)).toThrow("PRD not found");
  });

  test("loadManifest throws on missing config", () => {
    const manifestPath = resolve(MANIFEST_DIR, "no-config.yaml");
    writeFileSync(
      manifestPath,
      `phases:\n  - prd: ../prds/PRD-phase-1.md\n    label: "Phase 1"\n`
    );
    expect(() => loadManifest(manifestPath)).toThrow("missing required field: config");
  });

  test("loadManifest throws on missing label", () => {
    const manifestPath = resolve(MANIFEST_DIR, "no-label.yaml");
    writeFileSync(
      manifestPath,
      `config: ../shipwright.yaml\nphases:\n  - prd: ../prds/PRD-phase-1.md\n`
    );
    expect(() => loadManifest(manifestPath)).toThrow('missing required field "label"');
  });

  test("loadManifest throws on missing prd field", () => {
    const manifestPath = resolve(MANIFEST_DIR, "no-prd-field.yaml");
    writeFileSync(
      manifestPath,
      `config: ../shipwright.yaml\nphases:\n  - label: "Phase 1"\n`
    );
    expect(() => loadManifest(manifestPath)).toThrow('missing required field "prd"');
  });

  test("loadManifest resolves paths relative to manifest", () => {
    const manifestPath = resolve(MANIFEST_DIR, "relative.yaml");
    writeFileSync(
      manifestPath,
      `config: ../shipwright.yaml\nphases:\n  - prd: ../prds/PRD-phase-1.md\n    label: "Phase 1"\n`
    );

    const manifest = loadManifest(manifestPath);
    expect(manifest.phases[0].prd).toBe(resolve(PRDS_DIR, "PRD-phase-1.md"));
    expect(manifest.baseDir).toBe(MANIFEST_DIR);
  });
});

// --- Campaign Runner (unit tests — no real pipeline) ---

describe("campaign runner formatting", () => {
  test("formatValidationSummary produces table", async () => {
    const { formatValidationSummary } = await import("../src/campaign/runner.js");

    const result = {
      phases: [
        { phaseIndex: 1, label: "Phase 1: Foundation", prd: "p1.md", verdict: "PASS" as const, cached: true, critical: 0, warning: 0, info: 0 },
        { phaseIndex: 2, label: "Phase 2: Core", prd: "p2.md", verdict: "REVIEW" as const, cached: false, critical: 0, warning: 2, info: 0 },
        { phaseIndex: 3, label: "Phase 3: Integration", prd: "p3.md", verdict: "BLOCK" as const, cached: false, critical: 1, warning: 0, info: 0 },
      ],
      passed: 1,
      review: 1,
      blocked: 1,
    };

    const output = formatValidationSummary(result, "test.yaml");
    expect(output).toContain("Campaign Validation Summary");
    expect(output).toContain("PASS (cached)");
    expect(output).toContain("REVIEW");
    expect(output).toContain("BLOCK");
    expect(output).toContain("1 passed, 1 review, 1 blocked");
  });

  test("formatBuildSummary shows completion", async () => {
    const { formatBuildSummary } = await import("../src/campaign/runner.js");

    const result = {
      phases: [
        { phaseIndex: 1, label: "Phase 1", prd: "p1.md", status: "complete" as const, sprintCount: 3, durationMs: 120000 },
        { phaseIndex: 2, label: "Phase 2", prd: "p2.md", status: "failed" as const, sprintCount: 2, durationMs: 60000, failedSprint: "sprint 2 (score: 4.2/10)" },
      ],
      completedCount: 1,
      totalCount: 3,
      failedAt: { phaseIndex: 2, label: "Phase 2" },
      totalDurationMs: 180000,
    };

    const output = formatBuildSummary(result, "test.yaml");
    expect(output).toContain("Campaign Stopped");
    expect(output).toContain("3 sprints");
    expect(output).toContain("FAILED");
    expect(output).toContain("1/3 phases");
    expect(output).toContain("--from 2");
  });

  test("formatBuildSummary shows full completion", async () => {
    const { formatBuildSummary } = await import("../src/campaign/runner.js");

    const result = {
      phases: [
        { phaseIndex: 1, label: "Phase 1", prd: "p1.md", status: "complete" as const, sprintCount: 2, durationMs: 60000 },
        { phaseIndex: 2, label: "Phase 2", prd: "p2.md", status: "complete" as const, sprintCount: 4, durationMs: 120000 },
      ],
      completedCount: 2,
      totalCount: 2,
      totalDurationMs: 180000,
    };

    const output = formatBuildSummary(result, "test.yaml");
    expect(output).toContain("Campaign Complete");
    expect(output).toContain("2/2 phases");
    expect(output).not.toContain("--from");
  });

  test("formatBuildSummary shows skipped phases", async () => {
    const { formatBuildSummary } = await import("../src/campaign/runner.js");

    const result = {
      phases: [
        { phaseIndex: 1, label: "Phase 1", prd: "p1.md", status: "skipped" as const, sprintCount: 0, durationMs: 0 },
        { phaseIndex: 2, label: "Phase 2", prd: "p2.md", status: "complete" as const, sprintCount: 3, durationMs: 90000 },
      ],
      completedCount: 1,
      totalCount: 2,
      totalDurationMs: 90000,
    };

    const output = formatBuildSummary(result, "test.yaml");
    expect(output).toContain("skipped");
  });
});
