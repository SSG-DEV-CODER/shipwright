# CLAUDE.md — Shipwright

## What This Is

Shipwright is an **adversarial build system with expert learning**. It takes PRD files as input, runs them through a multi-agent adversarial pipeline (Plan → Negotiate → Build → Evaluate → Retry), and self-improves its domain expertise after each successful sprint.

**Repo**: `SSG-DEV-CODER/shipwright` | **Runtime**: Bun | **Language**: TypeScript

## How It Works

```
PRD file → Parse → For each sprint:
  Scout (parallel) → Plan → Negotiate contract → Build → Evaluate
    → Pass (7+/10)? → Self-improve expertise → Git commit → Next sprint
    → Fail? → Retry with feedback (max 3) → Fail all? → Stop + report
```

### 6 Agents

| Agent | Model | Tools | Role |
|-------|-------|-------|------|
| Scout | sonnet | Read, Glob, Grep | Parallel codebase exploration |
| Planner | opus | Read, Glob, Grep | PRD → sprint plan |
| Negotiator | opus | Read | Contract mediation |
| Generator | opus | Read, Write, Edit, Bash, Glob, Grep | Code implementation (ONLY writer) |
| Evaluator | codex | Read, Bash, Glob, Grep | Adversarial review (NO write) |
| Improver | sonnet | Read, Glob, Grep | Expertise updates |

### Key Principle: Adversarial Tension

The Generator and Evaluator are adversaries. The Generator tries to pass. The Evaluator tries to find flaws. The Evaluator is explicitly told: "Do NOT be generous. Resist the inclination to praise."

### Key Principle: Expert Learning

Expertise YAML files (~600-1000 lines each) persist domain knowledge across builds. After each successful sprint, the Improver agent updates expertise with new patterns, gotchas, and decisions. Each build gets smarter.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Language | TypeScript (strict) |
| AI SDK | @anthropic-ai/claude-code (query() async generator) |
| Config | YAML (shipwright.yaml) |
| State | File-based (.shipwright/ directory, gitignored) |
| Expertise | YAML files (expertise/ directory, git-tracked) |
| Communication | File-based JSON (inter-agent, not shared conversations) |

---

## Directory Structure

```
shipwright/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config.ts             # Config loader
│   ├── intake/               # PRD parsing + sprint derivation
│   ├── expertise/            # Expertise YAML lifecycle
│   ├── agents/               # Agent SDK wrappers
│   ├── pipeline/             # Adversarial pipeline orchestration
│   ├── tracking/             # PROGRESS.md + LOG.md auto-writers
│   ├── prompts/              # Agent system prompts (markdown)
│   └── lib/                  # Shared utilities
├── expertise/                # Persistent YAML expertise files
├── templates/                # Output templates
├── docs/                     # PRD + progress + log for Shipwright itself
└── tests/                    # Tests
```

---

## Commands

```bash
# Run a PRD through the pipeline
bun run src/index.ts build <prd-path> [options]

# Manage expertise
bun run src/index.ts expertise list|validate|improve|create|question

# Pipeline state
bun run src/index.ts status
bun run src/index.ts resume

# Initialize config
bun run src/index.ts init

# Development
bun test                    # Run tests
bunx tsc --noEmit           # Type check
```

---

## Engineering Rules

1. **Generator is the ONLY writer.** No other agent creates or modifies files.
2. **Evaluator NEVER sees expertise.** Prevents leniency bias — evaluates from first principles.
3. **Contracts are immutable after signing.** No mid-build scope creep.
4. **File-based inter-agent communication.** JSON files in `.shipwright/`, inspectable and resumable.
5. **Sequential sprints, parallel scouts.** Sprints build on each other. Scouts are embarrassingly parallel.
6. **Expertise files are git-tracked.** They represent accumulated project knowledge.
7. **No database.** CLI tool, all state is files. Portable and self-contained.
8. **No network access for agents.** Prevents supply chain issues, keeps builds deterministic.

---

## Gotchas

1. **Claude Agent SDK import** — Dynamic import in `agents/base.ts` to gracefully handle missing SDK during dev.
2. **JSON extraction** — Models produce unreliable JSON. Always use `lib/json-extract.ts` multi-strategy parser.
3. **Expertise line limit** — Hard cap of 1000 lines per expertise YAML. Enforced by Improver.
4. **Cost tracking** — Per-agent, per-sprint, per-build. Respects limits in config.
5. **Git commits** — Prefix with `shipwright:` for easy filtering. Disabled with `--no-commit`.

---

## Development Sprints

| Sprint | Description | Status |
|--------|-------------|--------|
| 1 | Skeleton + CLI + Config + Types | COMPLETE |
| 2 | Intake + Base Agent + Scout | PENDING |
| 3 | Pipeline Core (Plan → Build → Evaluate) | PENDING |
| 4 | Contract Negotiation + Tracking | PENDING |
| 5 | Expertise System + Self-Improve | PENDING |
