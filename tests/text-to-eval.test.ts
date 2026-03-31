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
});
