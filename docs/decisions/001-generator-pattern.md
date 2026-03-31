# Decision 001: Generator Pattern — Line-by-Line Review

**Date:** 2026-03-31
**Participants:** Captain Jason + Claude Code

## Decisions Made

### 1. Generator Instruction — COMBINED
- Break PRD into small, atomic features (planner's job)
- Build ONE feature at a time, git commit after each
- Implement entire plan top to bottom without stopping
- Source: adversarial-dev (incremental commits) + agent-experts (don't stop)

### 2. Working Directory — AGENT-EXPERTS
- Planner produces exact file paths for every file
- Generator knows exactly what to create at each step
- No abstract "work in app/" — concrete paths like `src/lib/supabase.ts`

### 3. Spec Context — AGENT-EXPERTS
- Write the plan to a file on disk, generator reads it as needed
- Generator can re-reference the plan at any point during the build
- Avoids context window pollution from a massive initial prompt
- Plan stays accessible even 100+ tool calls deep

### 4. How Harness Knows Files Created — AGENT-EXPERTS
- Use `git diff --stat` after build to detect what was created/modified
- Harness can detect "generator did nothing" before wasting evaluator run
- Evaluator gets concrete file list to focus review on
- Tracking logs show real data (files, lines changed)

### 5. persistSession — ADVERSARIAL-DEV
- `true` for generator only
- Generator remembers what it built across incremental feature commits
- All other agents stay `false` (one-shot tasks)

### 6. maxTurns — AGENT-EXPERTS
- Unlimited (no cap)
- Don't optimize for cost — optimize for results
- The plan itself is the safeguard (finite steps = natural termination)
- A turn cap caused the evaluator failure in earlier runs

### 7. Feedback on Retry — ADVERSARIAL-DEV
- Full EvalResult from Codex evaluator on retry
- Written to feedback file on disk (consistent with decision #3)
- Generator reads feedback file, addresses every issue
- Complete scores, specific failures with file paths, detailed reasoning
