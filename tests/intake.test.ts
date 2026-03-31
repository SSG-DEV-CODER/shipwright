import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { parsePRD } from "../src/intake/prd-parser.js";
import { deriveSprints } from "../src/intake/sprint-planner.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { resolve } from "path";

const TEST_DIR = resolve(import.meta.dir, "../.test-tmp");
const TEST_PRD = resolve(TEST_DIR, "test-prd.md");

const SAMPLE_PRD = `# PRD: Test Feature

**Status:** Planning
**Owner:** Test User
**Created:** 2026-03-31

---

## Summary

A test feature for validating the PRD parser.

## Motivation

We need to test that the parser works correctly.

## Detailed Steps

### Step 1: Create the Config

Create the configuration file with proper types.

- Create \`src/config/types.ts\`
- Create \`src/config/loader.ts\`

### Step 2: Build the API

Build the REST API endpoints.

- Create \`src/api/routes.ts\`
- Modify \`src/index.ts\`

## Acceptance Criteria

- [ ] TypeScript compiles clean
- [ ] Config loads from YAML file
- [ ] API responds to GET /health
- [ ] All tests pass

## Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| 1 | Config module | Configuration loading and validation |
| 2 | API routes | REST API endpoint handlers |

## Open Questions

1. Should we use Zod for config validation?
2. What port should the API listen on?
`;

describe("PRD Parser", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_PRD, SAMPLE_PRD);
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("parses title", () => {
    const prd = parsePRD(TEST_PRD);
    expect(prd.title).toBe("Test Feature");
  });

  test("parses metadata", () => {
    const prd = parsePRD(TEST_PRD);
    expect(prd.status).toBe("Planning");
    expect(prd.owner).toBe("Test User");
    expect(prd.created).toBe("2026-03-31");
  });

  test("parses sections", () => {
    const prd = parsePRD(TEST_PRD);
    expect(prd.sections.length).toBeGreaterThan(3);
    expect(prd.sections.some((s) => s.heading.includes("Summary"))).toBe(true);
    expect(prd.sections.some((s) => s.heading.includes("Motivation"))).toBe(true);
  });

  test("extracts acceptance criteria from checklist", () => {
    const prd = parsePRD(TEST_PRD);
    expect(prd.acceptanceCriteria.length).toBe(4);
    expect(prd.acceptanceCriteria[0].text).toContain("TypeScript compiles clean");
    expect(prd.acceptanceCriteria[0].testable).toBe(true);
    expect(prd.acceptanceCriteria[0].validationCommand).toBe("bunx tsc --noEmit");
  });

  test("extracts deliverables from table", () => {
    const prd = parsePRD(TEST_PRD);
    expect(prd.deliverables.length).toBeGreaterThan(0);
  });

  test("extracts open questions", () => {
    const prd = parsePRD(TEST_PRD);
    expect(prd.openQuestions.length).toBe(2);
    expect(prd.openQuestions[0]).toContain("Zod");
  });

  test("parses summary content", () => {
    const prd = parsePRD(TEST_PRD);
    expect(prd.summary).toContain("test feature");
  });
});

describe("Sprint Planner", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_PRD, SAMPLE_PRD);
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("derives sprints from explicit steps", () => {
    const prd = parsePRD(TEST_PRD);
    const sprints = deriveSprints(prd);
    expect(sprints.length).toBe(2);
    expect(sprints[0].title).toContain("Config");
    expect(sprints[1].title).toContain("API");
  });

  test("sprints have sequential dependencies", () => {
    const prd = parsePRD(TEST_PRD);
    const sprints = deriveSprints(prd);
    expect(sprints[0].dependencies).toEqual([]);
    expect(sprints[1].dependencies).toEqual(["sprint-001"]);
  });

  test("sprints extract file targets", () => {
    const prd = parsePRD(TEST_PRD);
    const sprints = deriveSprints(prd);
    expect(sprints[0].fileTargets).toContain("src/config/types.ts");
    expect(sprints[1].fileTargets).toContain("src/api/routes.ts");
  });
});
