# Shipwright — Build Progress

**Last Updated:** 2026-03-31
**PRD:** [PRD-shipwright.md](PRD-shipwright.md)

---

## Sprint Overview

| Sprint | Description | Status | Date |
|--------|-------------|--------|------|
| 1 | Skeleton + CLI + Config + Types + Prompts | **COMPLETE** | 2026-03-31 |
| 2 | Intake (PRD parser) + Base Agent + Scout | **COMPLETE** | 2026-03-31 |
| 3 | Pipeline Core (Plan → Build → Evaluate + Retry) | **COMPLETE** | 2026-03-31 |
| 4 | Contract Negotiation + Tracking | **COMPLETE** | 2026-03-31 |
| 5 | Expertise System + Self-Improve + Resume | **COMPLETE** | 2026-03-31 |

---

## Sprint 1: Skeleton + CLI + Config + Types + Prompts

**Status:** COMPLETE
**Date:** 2026-03-31

### Deliverables

| # | Deliverable | Status |
|---|------------|--------|
| 1 | GitHub repo (SSG-DEV-CODER/shipwright) | DONE |
| 2 | package.json + tsconfig.json | DONE |
| 3 | CLI entry point (build, expertise, status, resume, init) | DONE |
| 4 | Config loader (shipwright.yaml → typed config) | DONE |
| 5 | All type definitions (intake, pipeline, expertise) | DONE |
| 6 | Agent base wrapper (claude-agent-sdk query()) | DONE |
| 7 | 6 agent prompt files (scout, planner, generator, evaluator, negotiator, improver) | DONE |
| 8 | Lib utilities (json-extract, cost, fs, yaml, markdown) | DONE |
| 9 | Templates (shipwright.yaml, PROGRESS, LOG, expertise) | DONE |
| 10 | CLAUDE.md + README.md | DONE |
| 11 | PRD + PROGRESS + LOG docs | DONE |

### Verification

- [ ] `bun run src/index.ts help` — CLI responds with usage
- [ ] `bunx tsc --noEmit` — TypeScript compiles clean
- [ ] Initial git commit pushed to GitHub

---

## Sprint 2: Intake + Base Agent + Scout — COMPLETE

- PRD parser: markdown → structured PRD with sections, criteria, deliverables
- Sprint planner: derives sprints from explicit steps, phases, or criteria
- Expertise loader: reads YAML files, formats for agent prompts
- Scout agent: parallel codebase exploration
- 10/10 tests passing

## Sprint 3: Pipeline Core — COMPLETE

- Planner, Generator, Evaluator agents wired
- Pipeline orchestrator: full sprint loop with retry
- State checkpointing to .shipwright/state.json
- CLI `build` command runs full pipeline

## Sprint 4: Contract Negotiation + Tracking — COMPLETE

- Negotiator agent: mediates planner ↔ evaluator contracts
- PROGRESS.md auto-writer with per-sprint status
- LOG.md auto-writer with timestamped entries
- Git commit helper with shipwright: prefix

## Sprint 5: Expertise System + Self-Improve — COMPLETE

- Expertise updater: merges learnings into YAML files
- Improver agent: extracts patterns/gotchas/decisions from builds
- Expertise validator: checks claims against filesystem
- Negotiator wired into pipeline (replaces inline contract)
- Improver wired into pipeline (auto-updates after success)
- Full tracking integration (progress + log + git)

## All Sprints Complete

Shipwright v0.1.0 is feature-complete. Ready for first real test: running against PRD-platform-restructure-phase-1.md with choff-platform as reference.
