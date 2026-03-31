# Shipwright

Adversarial build system with expert learning. Takes PRDs, builds software through an adversarial multi-agent pipeline with persistent expertise.

## Overview

Shipwright combines two patterns:

1. **Adversarial pipeline** — Separate agents for planning, building, and evaluating. The Evaluator adversarially attacks what the Generator builds. Quality is forced upward through tension, not self-review.

2. **Expert learning** — Persistent YAML expertise files accumulate domain knowledge across builds. Each successful sprint makes the system smarter.

## Quick Start

```bash
# Clone
git clone https://github.com/SSG-DEV-CODER/shipwright.git
cd shipwright

# Install
bun install

# Initialize config in your target project
cd /path/to/your/project
bun /path/to/shipwright/src/index.ts init

# Run a PRD
bun /path/to/shipwright/src/index.ts build docs/plans/PRD-feature.md
```

## How It Works

```
PRD → Parse sprints → For each sprint:
  1. Scout — Explore codebase (parallel, read-only)
  2. Plan — Generate implementation steps
  3. Negotiate — Lock contract with testable criteria
  4. Build — Generator implements code
  5. Evaluate — Evaluator adversarially reviews (7+/10 to pass)
  6. Retry — If failed, Generator gets feedback and retries (max 3)
  7. Improve — Update expertise with learnings
  8. Commit — Atomic git commit
```

## CLI

```bash
shipwright build <prd-path>           # Run a PRD through the pipeline
shipwright build PRD.md --dry-run     # Plan + negotiate only
shipwright build PRD.md --sprint 2    # Run only sprint 2

shipwright expertise list             # List expertise files
shipwright expertise improve <domain> # Run self-improve cycle
shipwright expertise create <domain>  # Create new expertise file

shipwright status                     # Show pipeline state
shipwright resume                     # Resume from checkpoint
shipwright init                       # Create shipwright.yaml
```

## Configuration

See `templates/shipwright.yaml` for all options. Key settings:

- **models** — Model per agent role (opus for planning/building/evaluating, sonnet for scouting/improving)
- **pipeline.eval_pass_threshold** — Score required to pass (default: 7.0/10)
- **pipeline.max_retries** — Retries per sprint (default: 3)
- **references** — Read-only codebases for scout context
- **limits** — Cost caps per sprint and per build

## Requirements

- [Bun](https://bun.sh) >= 1.1.0
- Anthropic API key (for Claude Agent SDK)

## License

Private — SSG-DEV-CODER
