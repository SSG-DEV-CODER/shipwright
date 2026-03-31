/**
 * Secondary extraction: parse evaluation text into structured EvalResult
 * when the agent doesn't produce clean JSON.
 *
 * Extracts scores, pass/fail signals, and failure reasons from natural language.
 */

import type { EvalResult, EvalScore } from "../pipeline/types.js";
import type { AcceptanceCriterion } from "../intake/types.js";

/**
 * Attempt to extract structured evaluation from agent text output.
 * Used as fallback when extractJson() fails to find a JSON block.
 */
export function extractEvalFromText(
  text: string,
  criteria: AcceptanceCriterion[],
  threshold: number = 7.0
): EvalResult | null {
  if (!text || text.length < 50) return null;

  const scores: EvalScore[] = [];

  // Strategy 1: Look for score patterns like "7/10", "score: 8", "Score: 4/10"
  for (const criterion of criteria) {
    const score = findScoreForCriterion(text, criterion);
    scores.push(score);
  }

  // Strategy 2: If no criterion-specific scores found, look for global patterns
  if (scores.every((s) => s.score === 0)) {
    const globalScore = extractGlobalScore(text);
    if (globalScore > 0) {
      for (const s of scores) {
        s.score = globalScore;
        s.reasoning = "Score extracted from global evaluation";
      }
    }
  }

  // Strategy 3: Infer from pass/fail language
  if (scores.every((s) => s.score === 0)) {
    const passSignals = countPassSignals(text);
    const failSignals = countFailSignals(text);
    const total = passSignals + failSignals;
    if (total > 0) {
      const inferredScore = Math.round((passSignals / total) * 10);
      for (const s of scores) {
        s.score = inferredScore;
        s.reasoning = `Inferred from text analysis (${passSignals} pass / ${failSignals} fail signals)`;
      }
    }
  }

  // If still no scores, check if there are at least failure reasons to report
  if (scores.every((s) => s.score === 0)) {
    const failureReasons = extractFailureReasons(text);
    if (failureReasons.length > 0) {
      // We found failure descriptions but no scores — assign score 2 (broken)
      for (const s of scores) {
        s.score = 2;
        s.reasoning = "Inferred low score from failure descriptions in evaluation text";
      }
    } else {
      return null;
    }
  }

  const overallScore = scores.length > 0
    ? Math.round((scores.reduce((sum, s) => sum + s.score, 0) / scores.length) * 10) / 10
    : 0;

  const passed = overallScore >= threshold && scores.every((s) => s.score >= threshold);

  const failureReasons = extractFailureReasons(text);
  const feedback = extractFeedbackSection(text);

  return {
    passed,
    overallScore,
    scores,
    feedback: feedback || text.slice(0, 2000),
    failureReasons: failureReasons.length > 0
      ? failureReasons
      : passed ? [] : ["See feedback for details"],
  };
}

function findScoreForCriterion(text: string, criterion: AcceptanceCriterion): EvalScore {
  const lower = text.toLowerCase();
  const criterionWords = criterion.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

  // Find text sections that mention this criterion
  const lines = text.split("\n");
  let bestScore = 0;
  let bestReasoning = "";
  let specificFailures: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    const matchCount = criterionWords.filter((w) => line.includes(w)).length;

    if (matchCount >= 2 || line.includes(criterion.id.toLowerCase())) {
      // Found a relevant line — look for a score nearby
      const nearbyText = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join("\n");
      const score = extractScoreFromText(nearbyText);
      if (score > bestScore) {
        bestScore = score;
        bestReasoning = lines[i].trim();
      }

      // Look for failure indicators
      const failureLines = lines.slice(i, Math.min(lines.length, i + 5));
      for (const fl of failureLines) {
        if (fl.match(/error|fail|missing|broken|crash|undefined|cannot|not found/i)) {
          specificFailures.push(fl.trim());
        }
      }
    }
  }

  return {
    criterionId: criterion.id,
    criterion: criterion.text,
    score: bestScore,
    reasoning: bestReasoning || "Could not find evaluation for this criterion",
    specificFailures: specificFailures.slice(0, 5),
  };
}

function extractScoreFromText(text: string): number {
  // Pattern: "7/10", "score: 8", "Score: 4/10", "rated 6 out of 10"
  const patterns = [
    /(\d+)\s*\/\s*10/,
    /score[:\s]+(\d+)/i,
    /rated?\s+(\d+)/i,
    /(\d+)\s+out\s+of\s+10/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 0 && score <= 10) return score;
    }
  }
  return 0;
}

function extractGlobalScore(text: string): number {
  // Look for overall/total/final score
  const patterns = [
    /overall\s*(?:score)?[:\s]+(\d+)\s*\/?\s*10?/i,
    /total\s*(?:score)?[:\s]+(\d+)\s*\/?\s*10?/i,
    /final\s*(?:score)?[:\s]+(\d+)\s*\/?\s*10?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 0 && score <= 10) return score;
    }
  }
  return 0;
}

function countPassSignals(text: string): number {
  const passPatterns = [
    /\bpass(?:es|ed|ing)?\b/gi,
    /\bworks?\b/gi,
    /\bcorrect\b/gi,
    /\bsuccess/gi,
    /✅/g,
    /\byes\b/gi,
    /\bgood\b/gi,
    /\bclean\b/gi,
  ];
  return passPatterns.reduce((sum, p) => sum + (text.match(p)?.length ?? 0), 0);
}

function countFailSignals(text: string): number {
  const failPatterns = [
    /\bfail(?:s|ed|ing|ure)?\b/gi,
    /\berror\b/gi,
    /\bmissing\b/gi,
    /\bbroken\b/gi,
    /\bcrash/gi,
    /❌/g,
    /\bnot found\b/gi,
    /\bundefined\b/gi,
    /\bbug\b/gi,
    /\bwrong\b/gi,
  ];
  return failPatterns.reduce((sum, p) => sum + (text.match(p)?.length ?? 0), 0);
}

function extractFailureReasons(text: string): string[] {
  const reasons: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Lines that look like failure descriptions
    if (
      trimmed.match(/^[-*]\s*(missing|no |cannot |error|fail|broken|not found|does not|doesn't)/i) ||
      trimmed.match(/^[-*]\s*\[?(❌|FAIL|ERROR)/i)
    ) {
      const clean = trimmed.replace(/^[-*]\s*/, "").replace(/^[❌✅]\s*/, "").trim();
      if (clean.length > 10 && clean.length < 200) {
        reasons.push(clean);
      }
    }
  }

  return reasons.slice(0, 10);
}

function extractFeedbackSection(text: string): string {
  // Look for a "feedback" or "summary" section
  const sections = text.split(/\n(?:#{1,3}\s)/);
  for (const section of sections) {
    if (section.match(/feedback|summary|conclusion|recommendation|verdict/i)) {
      return section.trim().slice(0, 2000);
    }
  }
  // Fallback: last 2000 chars (most likely contains the summary)
  return text.slice(-2000).trim();
}
