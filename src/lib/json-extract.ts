/**
 * Multi-strategy JSON extraction from LLM output
 *
 * Models are unreliable at producing clean JSON. This module tries multiple
 * extraction strategies before falling back to defaults.
 *
 * Ported from adversarial-dev's shared/files.ts pattern.
 */

/**
 * Extract JSON from LLM text output using 3 strategies:
 * 1. Find JSON in code blocks (```json ... ```)
 * 2. Find JSON by brace matching with expected keys
 * 3. Try parsing raw text directly
 */
export function extractJson<T>(
  text: string,
  expectedKeys: string[],
  fallback: T
): T {
  // Strategy 1: Code block extraction
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (hasExpectedKeys(parsed, expectedKeys)) {
        return parsed as T;
      }
    } catch {
      // fall through to next strategy
    }
  }

  // Strategy 2: Brace matching with key detection
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = text.slice(braceStart, braceEnd + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (hasExpectedKeys(parsed, expectedKeys)) {
        return parsed as T;
      }
    } catch {
      // fall through to next strategy
    }
  }

  // Strategy 3: Array extraction (for array responses)
  const bracketStart = text.indexOf("[");
  const bracketEnd = text.lastIndexOf("]");
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    const candidate = text.slice(bracketStart, bracketEnd + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      // fall through
    }
  }

  // Strategy 4: Raw text
  try {
    const parsed = JSON.parse(text.trim());
    return parsed as T;
  } catch {
    // all strategies failed
  }

  return fallback;
}

function hasExpectedKeys(obj: unknown, keys: string[]): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  return keys.some((key) => key in obj);
}
