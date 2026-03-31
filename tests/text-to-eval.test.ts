import { describe, test, expect } from "bun:test";
import { extractEvalFromText } from "../src/lib/text-to-eval.js";
import type { AcceptanceCriterion } from "../src/intake/types.js";

const SAMPLE_CRITERIA: AcceptanceCriterion[] = [
  { id: "ac-001", text: "TypeScript compiles clean", source: "test", testable: true, validationCommand: "bunx tsc --noEmit" },
  { id: "ac-002", text: "API responds to GET /health", source: "test", testable: true },
  { id: "ac-003", text: "Payload admin loads", source: "test", testable: true },
];

describe("Text-to-Eval Extraction", () => {
  test("extracts scores from text with score patterns", () => {
    const text = `
## Evaluation

### TypeScript compiles clean
Running bunx tsc --noEmit... Found 3 errors.
Score: 3/10
The TypeScript compilation fails with missing type imports.

### API responds to GET /health
The health endpoint returns 200 OK with expected JSON.
Score: 8/10
Works correctly.

### Payload admin loads
The Payload admin panel loads at /admin but shows empty collections.
Score: 6/10
Partially works but missing collection registrations.

Overall score: 5.7/10
    `;

    const result = extractEvalFromText(text, SAMPLE_CRITERIA);
    expect(result).not.toBeNull();
    expect(result!.scores.length).toBe(3);
    expect(result!.scores[0].score).toBe(3);
    expect(result!.scores[1].score).toBe(8);
    expect(result!.scores[2].score).toBe(6);
    expect(result!.passed).toBe(false); // 3 and 6 are below 7
  });

  test("extracts from pass/fail signals when no explicit scores", () => {
    const text = `
Looking at the codebase:
- TypeScript compilation FAILS with 12 errors
- Missing dependencies — error: Cannot find module
- The API is broken — returns 500
- Config file is missing required fields
- No tests found
- Build fails completely
    `;

    const result = extractEvalFromText(text, SAMPLE_CRITERIA);
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(false);
    // Should detect many fail signals
    expect(result!.overallScore).toBeLessThan(5);
  });

  test("extracts failure reasons from bullet points", () => {
    const text = `
## Findings
- Missing supabase client module at src/lib/supabase.ts
- Cannot find type definitions for Payload collections
- Error: Module '@/lib/utils' not found
- Not found: template.config.ts default export
- Does not compile — 47 TypeScript errors
    `;

    const result = extractEvalFromText(text, SAMPLE_CRITERIA);
    expect(result).not.toBeNull();
    expect(result!.failureReasons.length).toBeGreaterThan(0);
  });

  test("returns null for empty or very short text", () => {
    expect(extractEvalFromText("", SAMPLE_CRITERIA)).toBeNull();
    expect(extractEvalFromText("ok", SAMPLE_CRITERIA)).toBeNull();
  });

  test("detects passing evaluation", () => {
    const text = `
## Evaluation Results

### TypeScript compiles clean
Score: 9/10 — compiles with zero errors after fixing one import.

### API responds to GET /health
Score: 8/10 — returns proper JSON health response.

### Payload admin loads
Score: 7/10 — admin loads with all collections visible.

Overall: 8/10 — solid implementation.
    `;

    const result = extractEvalFromText(text, SAMPLE_CRITERIA);
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(true);
    expect(result!.overallScore).toBeGreaterThanOrEqual(7);
  });

  test("parses structured markdown format (### SCORE: ac-001)", () => {
    const text = `
## EVALUATION RESULT

### OVERALL
- passed: false
- overallScore: 4.7

### SCORE: ac-001
- criterion: TypeScript compiles clean
- score: 3/10
- reasoning: Compilation fails with 12 errors
- failures: src/lib/supabase.ts:5 — Cannot find module
- failures: src/payload.config.ts:12 — Property does not exist

### SCORE: ac-002
- criterion: API responds to GET /health
- score: 8/10
- reasoning: Health endpoint returns 200 OK
- failures: none

### SCORE: ac-003
- criterion: Payload admin loads
- score: 3/10
- reasoning: Admin page crashes — missing collection registrations
- failures: No collections registered in payload.config.ts

### FEEDBACK
The TypeScript compilation has 12 errors. Fix the missing supabase module
and register Payload collections before the admin will work.

### FAILURE REASONS
- Missing supabase dependency in package.json
- TypeScript compilation fails with 12 errors
- No Payload collections registered
    `;

    const result = extractEvalFromText(text, SAMPLE_CRITERIA);
    expect(result).not.toBeNull();
    expect(result!.passed).toBe(false);
    expect(result!.overallScore).toBeCloseTo(4.7, 0);
    expect(result!.scores.length).toBe(3);
    expect(result!.scores[0].score).toBe(3);
    expect(result!.scores[0].specificFailures.length).toBe(2);
    expect(result!.scores[1].score).toBe(8);
    expect(result!.scores[2].score).toBe(3);
    expect(result!.failureReasons.length).toBeGreaterThan(0);
    expect(result!.feedback).toContain("TypeScript compilation");
  });
});
