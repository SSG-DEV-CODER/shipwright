# Decision 002: Smart Retry Routing — Failure Categorisation + Plan Amendment

**Date:** 2026-03-31
**Participants:** Captain Jason + Claude Code

## Problem

The retry loop was dumb — when the evaluator failed a sprint, the orchestrator blindly sent the same feedback to the same generator with the same plan. This wasted tokens when:
- The failure was an infrastructure issue (no database, no .env) — code changes can't fix this
- The failure was a plan gap (missing steps, files not planned) — the generator can't create what the plan doesn't mention
- Scores were trending down — more retries of the same approach make things worse

Neither adversarial-dev nor agent-experts solve this. Both treat the plan as immutable and only retry the generator. This is genuinely new in Shipwright.

## Solution

### 1. Failure Categorisation
The evaluator now categorises each failed criterion:
- **CODE** — TypeScript errors, logic bugs, wrong types → Generator retries
- **PLAN** — Missing files, incomplete scope, wrong structure → Planner amends plan
- **INFRA** — No database, missing .env, deps not installed → Generator gets explicit setup instructions

### 2. Smart Routing
The orchestrator routes failures to the right agent:
- All CODE → standard generator retry
- Any PLAN → re-run planner to amend plan, THEN generator retries
- Any INFRA → prepend infrastructure setup instructions to feedback

### 3. Trend Detection
- Score improved → continue retrying
- Score flat or dropped after 2+ attempts → stop early (don't waste tokens)
- Score stagnant → force plan amendment (the plan itself may be wrong)

## Implementation
- Evaluator prompt updated with failure category instructions
- Codex JSON schema updated with failureCategory per score + failureCategories array
- Text-to-eval parser extracts categories from structured markdown
- Orchestrator categoriseFailures() uses 3 strategies: explicit categories → per-score → keyword heuristic
- Plan amendment re-runs planner with failure context
- Infra failures prepend setup instructions to feedback file
