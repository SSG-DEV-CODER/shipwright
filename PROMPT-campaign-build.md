# Task: Implement Validation Caching + Campaign Command

## Context

You are working on the Shipwright codebase — an adversarial build system CLI tool at `/Users/maffy/Developer/shipwright`. The PRD for this task is at `PRD-shipwright-campaign-and-cache.md` (in the repo root). Read it completely before starting.

## What to build

Two features that improve the multi-PRD workflow:

### Feature 1: Validation Caching
- Before running the validator agent, SHA-256 hash the PRD file content
- Check `.shipwright/validation-cache.json` — if hash matches and entry is <7 days old, skip validation
- Track pass count per PRD. After 3 validation passes, downgrade remaining criticals to warnings and let the build proceed
- Add `--force-validate` CLI flag to bypass cache
- New file: `src/pipeline/validation-cache.ts`
- Modify: `src/pipeline/orchestrator.ts` (check cache before `runValidator()`)
- Modify: `src/index.ts` (add `--force-validate` flag)

### Feature 2: Campaign Command
- New manifest YAML format listing PRDs in order with labels
- `shipwright campaign validate <manifest>` — validate all PRDs (cache-aware), print summary table
- `shipwright campaign build <manifest>` — build all phases in sequence with `--no-validate`, stop on failure
- `--from N` flag to resume from a specific phase
- `--only N` flag to build a single phase
- New files: `src/campaign/manifest.ts`, `src/campaign/runner.ts`
- Modify: `src/index.ts` (add `campaign` command)
- New template: `templates/campaign.yaml`

## Important constraints

- Read `CLAUDE.md` for engineering rules (Bun runtime, TypeScript strict, no `bun build`)
- Read `src/index.ts` for how existing CLI commands are structured — follow the same pattern
- Read `src/pipeline/orchestrator.ts` to understand how `runPipeline()` works — the campaign runner calls it
- Read `src/config.ts` for how YAML configs are loaded — follow the same pattern for manifests
- All new code must pass `bunx tsc --noEmit` and `bun test`
- Write tests in `tests/campaign.test.ts`
- Do NOT modify any agent logic (scout, planner, generator, evaluator, etc.)
- Do NOT add any external dependencies — use only what's already in package.json (yaml, fs, path, crypto)

## Steps

1. Read the full PRD at `PRD-shipwright-campaign-and-cache.md`
2. Read `CLAUDE.md`, `src/index.ts`, `src/pipeline/orchestrator.ts`, `src/config.ts`
3. Implement validation cache (`src/pipeline/validation-cache.ts`)
4. Wire cache into `orchestrator.ts`
5. Implement campaign manifest parser (`src/campaign/manifest.ts`)
6. Implement campaign runner (`src/campaign/runner.ts`)
7. Add campaign commands to `src/index.ts`
8. Create `templates/campaign.yaml`
9. Write tests in `tests/campaign.test.ts`
10. Run `bunx tsc --noEmit` and `bun test` to verify
