# PRD: Validation Caching + Campaign Command

**Status:** Ready for implementation
**Author:** Architecture review session, 2026-04-04
**Target repo:** platform-shipwright (Shipwright itself)
**Depends on:** Nothing — additive features to existing CLI

---

## 1. Objective

Eliminate redundant validation token spend and manual command repetition when working with multi-PRD projects. Two features:

1. **Validation caching** — skip re-validating PRDs that haven't changed since last successful validation
2. **Campaign command** — define all PRDs in a manifest file, validate and build them with a single command

## 2. Current Pain

- Validator is stateless. Every `shipwright build` re-validates the entire PRD from scratch, even if nothing changed. On a 7-PRD project with 2-3 iteration passes, that's 14-21 redundant validation runs burning subscription tokens and wall-clock time.
- Each phase requires a manual CLI invocation. A 7-phase project means typing 7+ commands and babysitting each transition. No way to say "build all phases in order."

## 3. Feature 1: Validation Caching

### How It Works

1. After a successful validation (verdict: PASS or REVIEW), compute a SHA-256 hash of the PRD file content
2. Store the hash + validation result + timestamp in `.shipwright/validation-cache.json`
3. On next run, before invoking the validator agent:
   - Hash the current PRD content
   - If hash matches cache entry → skip validation, log `[VALIDATE] Cache hit — PRD unchanged since last validation`
   - If hash differs or no cache entry → run validator normally, update cache on completion

### Cache File Format

```json
{
  "entries": {
    "prds/PRD-phase-1-bot-standalone.md": {
      "contentHash": "sha256:a1b2c3d4...",
      "verdict": "PASS",
      "critical": 0,
      "warning": 2,
      "info": 1,
      "validatedAt": "2026-04-04T12:00:00Z",
      "reportPath": ".shipwright/validation-report.json"
    }
  }
}
```

### Cache Location

`.shipwright/validation-cache.json` in the Shipwright project directory (not the target dir).

### Cache Invalidation

- PRD content changes (different hash) → re-validate
- User passes `--force-validate` flag → ignore cache, re-validate all
- User passes `--no-validate` → skip validation entirely (existing behavior, unchanged)
- Cache entries older than 7 days → re-validate (vendor docs may have changed)

### Validation Pass Limit

Each PRD gets a maximum of **3 validation passes** (configurable via `max_validation_passes` in campaign manifest or build config). The behavior:

- **Pass 1**: Full validation. Criticals block.
- **Pass 2**: Re-validates only if PRD changed (hash check). Criticals block.
- **Pass 3**: Final attempt. Criticals block.
- **After 3 passes**: Remaining criticals are **downgraded to warnings**. The build proceeds. The validator logs a notice: `[VALIDATE] Max validation passes (3) reached — remaining criticals downgraded to warnings. The evaluator will catch real failures during build.`

The pass count is tracked per-PRD in the validation cache:

```json
{
  "entries": {
    "prds/PRD-phase-1-bot-standalone.md": {
      "contentHash": "sha256:a1b2c3d4...",
      "verdict": "BLOCK",
      "passCount": 3,
      "validatedAt": "2026-04-04T12:00:00Z"
    }
  }
}
```

Rationale: The validator is a pre-flight check, not the final authority. After 3 rounds, diminishing returns set in — the adversarial evaluator (running real code) is a better judge of what actually breaks. A bad PRD that truly can't pass validation after 3 rounds will fail at the evaluator stage anyway, where the smart retry routing can handle it.

### Implementation Scope

- New file: `src/pipeline/validation-cache.ts` — hash, read, write, check functions
- Modify: `src/pipeline/orchestrator.ts` — check cache before calling `runValidator()`
- Modify: `src/index.ts` — add `--force-validate` flag

## 4. Feature 2: Campaign Command

### Manifest File Format

```yaml
# builds/platform-campaign.yaml
config: builds/platform.yaml

phases:
  - prd: prds/PRD-phase-1-bot-standalone.md
    label: "Phase 1: Bot Standalone"
  - prd: prds/PRD-agent-runtime-extraction.md
    label: "Phase 2: Agent Runtime Extraction"
  - prd: prds/PRD-department-mcp-contract.md
    label: "Phase 3: Department MCP Contract"
  - prd: prds/PRD-executive-council-department.md
    label: "Phase 4: Executive Council"
  - prd: prds/PRD-phase-4-ccc-autonomy.md
    label: "Phase 5: CCC Autonomy"
  - prd: prds/PRD-phase-5-marketing-autonomy.md
    label: "Phase 6: Marketing Autonomy"
  - prd: prds/PRD-phase-6-devops-department.md
    label: "Phase 7: DevOps Department"
  - prd: prds/PRD-phase-7-bot-thinning.md
    label: "Phase 8: Bot Thinning"
```

### CLI Commands

```bash
# Validate all PRDs in the manifest (uses cache, only re-validates changed ones)
shipwright campaign validate <manifest-path>

# Build all phases in order (skips validation — assumes already validated)
shipwright campaign build <manifest-path>

# Build starting from a specific phase (phases before it are assumed complete)
shipwright campaign build <manifest-path> --from <phase-number>

# Build a single specific phase only
shipwright campaign build <manifest-path> --only <phase-number>
```

### Campaign Validate Behavior

1. Parse the manifest, resolve all PRD paths
2. For each PRD:
   - Check validation cache → skip if hash matches
   - Run validator if cache miss
   - Update cache with result
3. Print summary table:

```
⚓ Campaign Validation Summary
═══════════════════════════════════════════════════
  Phase 1: Bot Standalone             ✅ PASS (cached)
  Phase 2: Agent Runtime Extraction   ✅ PASS (cached)
  Phase 3: Department MCP Contract    ⚠️  REVIEW — 2 warnings
  Phase 4: Executive Council          🛑 BLOCK — 1 critical
  Phase 5: CCC Autonomy              ✅ PASS
  Phase 6: Marketing Autonomy         ✅ PASS
  Phase 7: DevOps Department          ⚠️  REVIEW — 1 warning
  Phase 8: Bot Thinning              ✅ PASS (cached)
═══════════════════════════════════════════════════
  Result: 5 passed, 2 review, 1 blocked

  Fix Phase 4 critical issues, then re-run.
  Only Phase 4 will be re-validated (others cached).
```

4. Exit code:
   - 0 = all PASS or REVIEW
   - 1 = any BLOCK (criticals exist)

### Campaign Build Behavior

1. Parse the manifest
2. For each phase in order:
   - Log phase header: `═══ Phase 3/8: Department MCP Contract ═══`
   - Run `runPipeline()` with `noValidate: true` (validation already done)
   - If build succeeds → advance to next phase
   - If build fails → stop, report which phase failed, exit with error
3. Between phases, log a brief status:

```
═══ Phase 1/8 COMPLETE: Bot Standalone (4 sprints, 12m 34s) ═══
═══ Starting Phase 2/8: Agent Runtime Extraction ═══
```

4. At the end, print campaign summary:

```
⚓ Campaign Complete
═══════════════════════════════════════════════════
  Phase 1: Bot Standalone             ✅ 4 sprints, 12m 34s
  Phase 2: Agent Runtime Extraction   ✅ 6 sprints, 28m 12s
  Phase 3: Department MCP Contract    ✅ 3 sprints, 8m 45s
  Phase 4: Executive Council          ❌ FAILED sprint 2/5 (score: 4.2/10)
═══════════════════════════════════════════════════
  Completed: 3/8 phases
  Failed at: Phase 4 — Executive Council
  Resume with: shipwright campaign build builds/platform-campaign.yaml --from 4
```

### Resume / --from Behavior

When `--from N` is passed:
- Skip phases 1 through N-1 (assume already built)
- Start building from phase N
- Useful after fixing a failed phase

### Implementation Scope

- New file: `src/campaign/manifest.ts` — parse manifest YAML, resolve paths, types
- New file: `src/campaign/runner.ts` — validate-all loop, build-all loop, summary formatting
- Modify: `src/index.ts` — add `campaign` command with `validate` and `build` subcommands, `--from` and `--only` flags

## 5. Implementation Steps

### Step 1: Validation Cache

1. Create `src/pipeline/validation-cache.ts`:
   - `hashPrd(prdPath: string): string` — SHA-256 of file content
   - `readCache(cacheDir: string): ValidationCache` — read/create cache file
   - `writeCache(cacheDir: string, cache: ValidationCache): void`
   - `isCacheValid(cache, prdPath, maxAgeDays): boolean` — hash match + age check
   - `updateCache(cache, prdPath, hash, result): void`

2. Modify `src/pipeline/orchestrator.ts`:
   - Before `runValidator()`, check cache
   - After successful validation, update cache
   - Respect `--force-validate` flag

3. Add `--force-validate` flag to CLI argument parsing in `src/index.ts`

### Step 2: Campaign Manifest

4. Create `src/campaign/manifest.ts`:
   - `CampaignManifest` type — config path + ordered phases array
   - `loadManifest(manifestPath: string): CampaignManifest` — parse YAML, validate paths exist
   - `CampaignPhase` type — prd path + label

### Step 3: Campaign Runner

5. Create `src/campaign/runner.ts`:
   - `validateCampaign(manifest, config): CampaignValidationResult` — loop all PRDs, use cache, return summary
   - `buildCampaign(manifest, config, options): CampaignBuildResult` — loop phases in order, call `runPipeline()`, track results
   - Summary formatting functions for terminal output

### Step 4: CLI Integration

6. Modify `src/index.ts`:
   - Add `campaign` command
   - Subcommands: `validate <manifest>`, `build <manifest>`
   - Flags: `--from <N>`, `--only <N>`, `--force-validate`
   - Update help text

### Step 5: Manifest Template

7. Create `templates/campaign.yaml` — template manifest for `shipwright init`

### Step 6: Tests

8. Add tests in `tests/campaign.test.ts`:
   - Manifest parsing (valid YAML, missing PRD paths, empty phases)
   - Validation cache (hash match, hash mismatch, expired entry, force flag)
   - Campaign runner (mock pipeline, phase ordering, --from flag, failure stops chain)

## 6. Acceptance Criteria

- [ ] `shipwright build <prd>` skips validation when PRD content hash matches cache
- [ ] `shipwright build <prd> --force-validate` re-validates even if cached
- [ ] Cache entries older than 7 days are re-validated
- [ ] `shipwright campaign validate <manifest>` validates all PRDs, shows summary table
- [ ] `shipwright campaign validate` only re-validates PRDs that changed (cache hit for others)
- [ ] `shipwright campaign build <manifest>` builds all phases in order with `--no-validate`
- [ ] `shipwright campaign build --from N` skips phases before N
- [ ] `shipwright campaign build --only N` builds only phase N
- [ ] Failed build stops the campaign and prints resume command
- [ ] Campaign summary shows per-phase timing and sprint counts
- [ ] After 3 validation passes on the same PRD, criticals are downgraded to warnings and build proceeds
- [ ] Pass count is tracked per-PRD in the validation cache
- [ ] All existing `shipwright build` behavior is unchanged (backwards compatible)
- [ ] `shipwright help` shows campaign commands

## 7. What Does NOT Change

- Single PRD `shipwright build` workflow is unchanged
- Validator agent logic is unchanged — only the decision to invoke it changes
- Pipeline internals (scout, plan, negotiate, build, evaluate) are unchanged
- No new AI agents — this is purely orchestration logic
- No database, no frontend — stays CLI-only

## 8. File Impact

| File | Change |
|------|--------|
| `src/pipeline/validation-cache.ts` | **New** — hash, read, write, check |
| `src/campaign/manifest.ts` | **New** — manifest types + parser |
| `src/campaign/runner.ts` | **New** — validate-all, build-all loops |
| `src/pipeline/orchestrator.ts` | **Modify** — cache check before validator |
| `src/index.ts` | **Modify** — add campaign command + flags |
| `templates/campaign.yaml` | **New** — template manifest |
| `tests/campaign.test.ts` | **New** — manifest, cache, runner tests |

Estimated: ~400-500 lines of new code, ~30 lines modified in existing files.
