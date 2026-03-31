# Shipwright — Build Progress

**Last Updated:** 2026-03-31
**PRD:** [PRD-shipwright.md](PRD-shipwright.md)

---

## Sprint Overview

| Sprint | Description | Status | Date |
|--------|-------------|--------|------|
| 1 | Skeleton + CLI + Config + Types + Prompts | **COMPLETE** | 2026-03-31 |
| 2 | Intake (PRD parser) + Base Agent + Scout | PENDING | — |
| 3 | Pipeline Core (Plan → Build → Evaluate + Retry) | PENDING | — |
| 4 | Contract Negotiation + Tracking | PENDING | — |
| 5 | Expertise System + Self-Improve + Resume | PENDING | — |

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

## Next Up: Sprint 2

PRD parser, base agent SDK integration, and scout agents for codebase exploration.
