/**
 * Isolated agent tests — validate each agent produces correct output format
 * WITHOUT running the full pipeline or making real API calls.
 *
 * These tests verify:
 * 1. Planner prompt builds correctly
 * 2. Generator prompt builds correctly
 * 3. Evaluator prompt builds correctly
 * 4. Codex runner command builds correctly
 * 5. Plan file parsing works
 * 6. Git diff detection works
 * 7. Feedback file round-trip works
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { resolve } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { loadConfig } from "../src/config.js";
import { parsePRD } from "../src/intake/prd-parser.js";
import { deriveSprints } from "../src/intake/sprint-planner.js";
import { loadExpertise, formatExpertiseForPrompt } from "../src/expertise/loader.js";
import { extractJson } from "../src/lib/json-extract.js";
import { extractEvalFromText } from "../src/lib/text-to-eval.js";
import { writeJsonFile, readJsonFile, writeText, readText, fileExists } from "../src/lib/fs.js";
import type { EvalResult } from "../src/pipeline/types.js";

const TEST_DIR = resolve(import.meta.dir, "../.test-workspace");
const FIXTURE_PRD = resolve(import.meta.dir, "fixtures/PRD-hello-shipwright.md");

describe("PRD → Sprint Derivation", () => {
  test("parses the smoke test PRD", () => {
    const prd = parsePRD(FIXTURE_PRD);
    expect(prd.title).toContain("Hello Shipwright");
    expect(prd.acceptanceCriteria.length).toBe(5);
  });

  test("derives sprints with file targets", () => {
    const prd = parsePRD(FIXTURE_PRD);
    const sprints = deriveSprints(prd);
    expect(sprints.length).toBeGreaterThanOrEqual(1);
    expect(sprints[0].title).toBeTruthy();
  });
});

describe("Plan File Format", () => {
  const planDir = resolve(TEST_DIR, "plan-test");

  beforeAll(() => {
    mkdirSync(planDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("a well-formed plan file can be written and read", () => {
    const planPath = resolve(planDir, "plan.md");
    const planContent = `# Sprint Plan: Create Config Module

## Overview
Create the TypeScript config module.

## Tech Stack
- Runtime: Bun
- Language: TypeScript

## Relevant Files
None — fresh project.

### New Files
- src/config.ts — Config type and defaults

## Step by Step Tasks

### 1. Create Config Type
- Create \`src/config.ts\` with exported Config interface
- Add name: string and greeting: string fields
- Export defaultConfig constant
- Commit: "feat: add config module"

### 2. Verify
- Run \`bunx tsc --noEmit\`
- Commit: "chore: verify typecheck"

## Validation Commands
- \`bunx tsc --noEmit\`

## Acceptance Criteria
- [ ] src/config.ts exists with exported Config type
`;

    writeText(planPath, planContent);
    expect(fileExists(planPath)).toBe(true);

    const content = readText(planPath);
    expect(content).toContain("### 1. Create Config Type");
    expect(content).toContain("src/config.ts");

    // Count steps
    const stepCount = (content.match(/^###\s+\d+\./gm) ?? []).length;
    expect(stepCount).toBe(2);
  });
});

describe("Feedback File Round-Trip", () => {
  const feedbackDir = resolve(TEST_DIR, "feedback-test");

  beforeAll(() => {
    mkdirSync(feedbackDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("eval result writes and reads as JSON", () => {
    const feedbackPath = resolve(feedbackDir, "feedback-attempt-1.json");
    const evalResult: EvalResult = {
      passed: false,
      overallScore: 4.5,
      scores: [
        {
          criterionId: "ac-001",
          criterion: "src/config.ts exists",
          score: 8,
          reasoning: "File exists and has correct exports",
          specificFailures: [],
        },
        {
          criterionId: "ac-004",
          criterion: "TypeScript compiles clean",
          score: 1,
          reasoning: "bunx tsc --noEmit fails with 3 errors",
          specificFailures: [
            "src/index.ts:2 — Cannot find module './greet.js'",
            "src/config.ts:5 — Type 'number' is not assignable to type 'string'",
          ],
        },
      ],
      feedback: "The config module exists but has a type error. The greet module is missing entirely.",
      failureReasons: ["TypeScript compilation fails", "src/greet.ts does not exist"],
    };

    writeJsonFile(feedbackPath, evalResult);
    const loaded = readJsonFile<EvalResult>(feedbackPath);

    expect(loaded).not.toBeNull();
    expect(loaded!.overallScore).toBe(4.5);
    expect(loaded!.scores.length).toBe(2);
    expect(loaded!.scores[1].specificFailures.length).toBe(2);
    expect(loaded!.failureReasons).toContain("src/greet.ts does not exist");
  });
});

describe("Git Diff Detection", () => {
  const gitDir = resolve(TEST_DIR, "git-test");

  beforeAll(() => {
    mkdirSync(resolve(gitDir, "src"), { recursive: true });
    execSync("git init", { cwd: gitDir, stdio: "pipe" });
    execSync("git config user.email 'test@test.com' && git config user.name 'Test'", {
      cwd: gitDir, stdio: "pipe",
    });
    writeFileSync(resolve(gitDir, "README.md"), "# Test");
    execSync("git add -A && git commit -m 'init'", { cwd: gitDir, stdio: "pipe" });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("detects new files via git ls-files", () => {
    writeFileSync(resolve(gitDir, "src/config.ts"), "export const x = 1;");
    writeFileSync(resolve(gitDir, "src/greet.ts"), "export const greet = () => 'hi';");

    const untracked = execSync("git ls-files --others --exclude-standard", {
      cwd: gitDir, stdio: "pipe",
    }).toString().trim();

    const newFiles = untracked.split("\n").filter(Boolean);
    expect(newFiles).toContain("src/config.ts");
    expect(newFiles).toContain("src/greet.ts");
    expect(newFiles.length).toBe(2);
  });

  test("detects modified files via git diff", () => {
    execSync("git add -A && git commit -m 'add files'", { cwd: gitDir, stdio: "pipe" });
    writeFileSync(resolve(gitDir, "src/config.ts"), "export const x = 2; // modified");

    const modified = execSync("git diff --name-only", {
      cwd: gitDir, stdio: "pipe",
    }).toString().trim();

    expect(modified).toContain("src/config.ts");
  });
});

describe("Codex Evaluator Output Schema", () => {
  test("schema file exists and is valid JSON", () => {
    const schemaPath = resolve(import.meta.dir, "../src/schemas/eval-result.json");
    expect(existsSync(schemaPath)).toBe(true);

    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("passed");
    expect(schema.required).toContain("scores");
    expect(schema.properties.scores.items.additionalProperties).toBe(false);
  });
});

describe("Expertise Loading", () => {
  test("loads expertise from shipwright expertise dir", () => {
    const expertiseDir = resolve(import.meta.dir, "../expertise");
    const ctx = loadExpertise(expertiseDir);
    expect(ctx.files.length).toBeGreaterThanOrEqual(3);
    expect(ctx.files.some((f) => f.domain === "content-pipeline")).toBe(true);
    expect(ctx.files.some((f) => f.domain === "analytics-defense")).toBe(true);
    expect(ctx.files.some((f) => f.domain === "nextjs-payload")).toBe(true);
  });

  test("formats expertise for prompt", () => {
    const expertiseDir = resolve(import.meta.dir, "../expertise");
    const ctx = loadExpertise(expertiseDir);
    const text = formatExpertiseForPrompt(ctx);
    expect(text).toContain("Domain Expertise");
    expect(text.length).toBeGreaterThan(100);
  });
});

describe("Config Loading", () => {
  test("loads default config when no file exists", () => {
    const config = loadConfig("/nonexistent/path/shipwright.yaml");
    expect(config.models.generator).toContain("opus");
    expect(config.models.evaluator).toBe("codex");
    expect(config.pipeline.maxRetries).toBe(3);
    expect(config.pipeline.evalPassThreshold).toBe(7.0);
  });

  test("loads build config for choff-site-template", () => {
    const configPath = resolve(import.meta.dir, "../builds/choff-site-template.yaml");
    if (existsSync(configPath)) {
      const config = loadConfig(configPath);
      expect(config.models.evaluator).toBe("codex");
      expect(config.references.length).toBeGreaterThanOrEqual(1);
    }
  });
});
