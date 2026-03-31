# PRD: Hello Shipwright — Pipeline Smoke Test

**Status:** Testing
**Owner:** Shipwright CI
**Created:** 2026-03-31

---

## Summary

Create a minimal TypeScript project with 3 source files that compiles clean and runs successfully. This is the smallest possible project to validate the Shipwright pipeline end-to-end.

## Motivation

Smoke test for the adversarial build pipeline. If Shipwright can't build 3 files that typecheck, it can't build anything.

## Detailed Steps

### Step 1: Create Project Foundation

Create `package.json` and `tsconfig.json` for a Bun TypeScript project.

- `package.json` with name, type module, and typescript dev dependency
- `tsconfig.json` with strict mode, ES2022 target, bundler module resolution

### Step 2: Create Config Module

Create `src/config.ts` with:

- An exported `Config` interface with `name: string` and `greeting: string`
- An exported `defaultConfig` constant implementing the interface

### Step 3: Create Greeting Module

Create `src/greet.ts` with:

- An exported `greet(name: string, greeting: string): string` function
- Returns a formatted greeting string

### Step 4: Create Entry Point

Create `src/index.ts` with:

- Imports `defaultConfig` from `./config.js`
- Imports `greet` from `./greet.js`
- Calls greet with the default config values
- Prints the result to stdout with `console.log`

## Acceptance Criteria

- [ ] `src/config.ts` exists with an exported Config type and defaultConfig
- [ ] `src/greet.ts` exists with an exported greet function
- [ ] `src/index.ts` exists and imports from both modules
- [ ] `bunx tsc --noEmit` passes with zero errors
- [ ] `bun run src/index.ts` outputs a greeting to stdout
