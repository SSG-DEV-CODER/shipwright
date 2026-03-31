# PRD: Shipwright — Adversarial Build System with Expert Learning

**Status:** Sprint 1 Complete
**Owner:** Captain Jason
**Created:** 2026-03-31

---

## Summary

A standalone CLI tool that combines adversarial multi-agent pipeline execution (from adversarial-dev) with persistent expertise learning (from agent-experts) to build software from PRD files. 6 agents (Scout, Planner, Negotiator, Generator, Evaluator, Improver) work in adversarial tension to produce quality-gated code that gets smarter with every build.

## Motivation

The CHOFF platform restructure requires building a site template from scratch and then replicating it across multiple sites. Manual implementation is slow and inconsistent. An automated build system with adversarial quality gates ensures:

1. **Consistent quality** — Every sprint passes the same evaluation bar (7+/10)
2. **No self-evaluation bias** — Generator and Evaluator are separate agents (different models: opus builds, codex evaluates)
3. **Compounding intelligence** — Expertise files learn from each build, making future builds faster and more accurate
4. **Repeatable process** — Same pipeline for every PRD, every site, every feature

## Architecture

### Pipeline Flow

```
PRD → Parse → For each sprint:
  Scout (parallel) → Plan → Negotiate → Build → Evaluate → Retry → Improve → Commit
```

### Agent Roster

| Agent | Model | Role |
|-------|-------|------|
| Scout | sonnet | Parallel codebase exploration (read-only) |
| Planner | opus | PRD + expertise → sprint plan |
| Negotiator | opus | Contract mediation |
| Generator | opus | Code implementation (only writer) |
| Evaluator | codex | Adversarial review (read + bash only) |
| Improver | sonnet | Post-success expertise update |

### Key Design Decisions

- D-001: Standalone repo (not a monorepo package) — Shipwright targets any codebase
- D-002: File-based inter-agent communication — inspectable, debuggable, resumable
- D-003: Evaluator never sees expertise — prevents leniency bias
- D-004: Evaluator uses Codex (not same model as Generator) — true adversarial tension from different AI perspective
- D-005: Contracts immutable after signing — no mid-build scope creep
- D-006: No database — CLI tool, all state is files
- D-007: Expertise files git-tracked — accumulated knowledge persists

## Implementation Sprints

| Sprint | Description | Status |
|--------|-------------|--------|
| 1 | Skeleton + CLI + Config + Types + Prompts | **COMPLETE** |
| 2 | Intake (PRD parser) + Base Agent + Scout | PENDING |
| 3 | Pipeline Core (Plan → Build → Evaluate + Retry) | PENDING |
| 4 | Contract Negotiation + Tracking (PROGRESS.md + LOG.md) | PENDING |
| 5 | Expertise System + Self-Improve + Resume | PENDING |

## Success Criteria

- [ ] `shipwright build <prd>` executes a PRD end-to-end with adversarial evaluation
- [ ] Failed sprints retry with specific feedback up to 3 times
- [ ] PROGRESS.md and LOG.md auto-update at every pipeline stage
- [ ] Expertise files update after successful sprints
- [ ] Pipeline resumes from checkpoint after interruption
- [ ] Cost tracking per agent, per sprint, per build
- [ ] Successfully builds choff-site-template from PRD-platform-restructure-phase-1.md

## Dependencies

- Bun >= 1.1.0
- @anthropic-ai/claude-code (Claude Agent SDK)
- Anthropic API key
- OpenAI Codex subscription (for Evaluator)
