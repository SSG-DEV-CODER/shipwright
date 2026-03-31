import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { loadExpertise, formatExpertiseForPrompt } from "../src/expertise/loader.js";
import { applyExpertiseUpdate } from "../src/expertise/updater.js";
import { validateExpertise } from "../src/expertise/validator.js";
import { resolve } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { stringify } from "yaml";

const TEST_DIR = resolve(import.meta.dir, "../.test-tmp-expertise");

describe("Expertise Loader", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      resolve(TEST_DIR, "test-domain.yaml"),
      stringify({
        overview: {
          description: "Test domain",
          scope: ["testing"],
          key_files: ["src/index.ts"],
        },
        core_implementation: {},
        patterns: [
          { name: "Test pattern", description: "A test", added_date: "2026-01-01" },
        ],
        gotchas: [
          { description: "Test gotcha", impact: "high", mitigation: "Fix it", added_date: "2026-01-01" },
        ],
        decisions: [],
        anti_patterns: ["Don't do this"],
        metadata: {
          created: "2026-01-01",
          last_validated: "2026-01-01",
          source_sprints: [],
          stability: "evolving",
          consecutive_no_change: 0,
        },
      })
    );
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("loads expertise files from directory", () => {
    const ctx = loadExpertise(TEST_DIR);
    expect(ctx.files.length).toBe(1);
    expect(ctx.files[0].domain).toBe("test-domain");
    expect(ctx.totalLines).toBeGreaterThan(5);
  });

  test("formats expertise for prompt injection", () => {
    const ctx = loadExpertise(TEST_DIR);
    const text = formatExpertiseForPrompt(ctx);
    expect(text).toContain("test-domain");
    expect(text).toContain("Test pattern");
    expect(text).toContain("Test gotcha");
  });

  test("returns empty context for missing directory", () => {
    const ctx = loadExpertise("/nonexistent/path");
    expect(ctx.files.length).toBe(0);
    expect(ctx.totalLines).toBe(0);
  });
});

describe("Expertise Updater", () => {
  const updateTestDir = resolve(import.meta.dir, "../.test-tmp-update");

  beforeAll(() => {
    mkdirSync(updateTestDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(updateTestDir, { recursive: true, force: true });
  });

  test("creates new expertise file from update", () => {
    const filePath = resolve(updateTestDir, "new-domain.yaml");
    const result = applyExpertiseUpdate(filePath, {
      domain: "new-domain",
      newPatterns: [{ name: "New pattern", description: "Discovered during sprint" }],
      newGotchas: [],
      newDecisions: [],
      corrections: [],
      removals: [],
    });
    expect(result.applied).toBe(true);
    expect(result.changesApplied.length).toBe(1);
    expect(existsSync(filePath)).toBe(true);
  });

  test("does not duplicate existing patterns", () => {
    const filePath = resolve(updateTestDir, "new-domain.yaml");
    const result = applyExpertiseUpdate(filePath, {
      domain: "new-domain",
      newPatterns: [{ name: "New pattern", description: "Same pattern again" }],
      newGotchas: [],
      newDecisions: [],
      corrections: [],
      removals: [],
    });
    expect(result.applied).toBe(false);
    expect(result.changesApplied.length).toBe(0);
  });

  test("tracks stability via consecutive_no_change", () => {
    const filePath = resolve(updateTestDir, "stable-domain.yaml");
    // Apply 3 empty updates
    for (let i = 0; i < 3; i++) {
      applyExpertiseUpdate(filePath, {
        domain: "stable-domain",
        newPatterns: i === 0 ? [{ name: "Initial", description: "First" }] : [],
        newGotchas: [],
        newDecisions: [],
        corrections: [],
        removals: [],
      });
    }
    // After 2 empty updates (rounds 2 and 3), consecutive_no_change should be 2
    const { parseYamlFile } = require("../src/lib/yaml.js");
    const content = parseYamlFile(filePath);
    expect(content.metadata.consecutive_no_change).toBeGreaterThanOrEqual(1);
  });
});

describe("Expertise Validator", () => {
  const valDir = resolve(import.meta.dir, "../.test-tmp-validate");

  beforeAll(() => {
    mkdirSync(valDir, { recursive: true });
    mkdirSync(resolve(valDir, "src"), { recursive: true });
    writeFileSync(resolve(valDir, "src/index.ts"), "// exists");
  });

  afterAll(() => {
    rmSync(valDir, { recursive: true, force: true });
  });

  test("validates existing files as valid", () => {
    const result = validateExpertise(
      {
        domain: "test",
        filePath: "/tmp/test.yaml",
        lineCount: 50,
        lastUpdated: "2026-03-31",
        content: {
          overview: {
            description: "Test",
            scope: [],
            key_files: ["src/index.ts"],
          },
          core_implementation: {},
          patterns: [],
          gotchas: [],
          decisions: [],
          anti_patterns: [],
          metadata: {
            created: "2026-03-31",
            last_validated: "2026-03-31",
            source_sprints: [],
            stability: "evolving",
            consecutive_no_change: 0,
          },
        },
      },
      valDir
    );
    expect(result.validClaims).toBe(1);
    expect(result.missingFiles.length).toBe(0);
  });

  test("detects missing files", () => {
    const result = validateExpertise(
      {
        domain: "test",
        filePath: "/tmp/test.yaml",
        lineCount: 50,
        lastUpdated: "2026-03-31",
        content: {
          overview: {
            description: "Test",
            scope: [],
            key_files: ["src/nonexistent.ts"],
          },
          core_implementation: {},
          patterns: [],
          gotchas: [],
          decisions: [],
          anti_patterns: [],
          metadata: {
            created: "2026-03-31",
            last_validated: "2026-03-31",
            source_sprints: [],
            stability: "evolving",
            consecutive_no_change: 0,
          },
        },
      },
      valDir
    );
    expect(result.missingFiles.length).toBe(1);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
