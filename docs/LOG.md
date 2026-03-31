# Shipwright — Decision Log

> Records architectural decisions, trade-offs, and session notes.

---

## 2026-03-31 — Project Creation

### Context

Building Shipwright as the execution engine for the CHOFF platform restructure. Combines adversarial pipeline (from coleam00/adversarial-dev) with expert learning (from agent-experts).

### Decisions

**D-001: Standalone repo, not a monorepo package**
- Shipwright targets any codebase, including itself and the CHOFF platform
- A standalone tool is more portable than a monorepo package
- Can be used for future projects beyond CHOFF

**D-002: File-based inter-agent communication**
- JSON files in `.shipwright/` directory
- Inspectable: you can read exactly what each agent received and produced
- Debuggable: if pipeline crashes, all intermediate state is on disk
- Resumable: `shipwright resume` reads state and picks up where it left off

**D-003: Evaluator never sees expertise files**
- Prevents the evaluator from being lenient toward known patterns
- Forces evaluation from first principles against the contract
- The evaluator should find bugs, not confirm expectations

**D-004: Evaluator uses Codex, not Opus**
- True adversarial tension: different model (different "brain") evaluating
- Codex subscription is flat-rate — no per-token cost for evaluation
- Different model may catch different classes of issues
- Strengthens the GAN analogy — generator and discriminator are fundamentally different

**D-005: Bun runtime**
- Consistent with CHOFF platform
- Fast startup for CLI tool
- Native TypeScript execution (no build step)
- Built-in test runner

**D-006: 6 agents with strict tool permissions**
- Only Generator can write files — all other agents are read-only
- Evaluator gets Bash for running validation commands (typecheck, test, lint) but cannot modify
- Scout, Planner, Negotiator, Improver are strictly read-only
- This prevents accidental file modification by non-builder agents

**D-007: Dynamic SDK import in agent base**
- `agents/base.ts` dynamically imports `@anthropic-ai/claude-code`
- Falls back to stub responses when SDK is not installed
- Allows development and testing of types/config/CLI without requiring API keys
