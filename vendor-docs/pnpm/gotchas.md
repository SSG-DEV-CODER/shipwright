# pnpm — Gotchas & Common Mistakes

<!-- Source: https://pnpm.io (Context7: /websites/pnpm_io) -->

## 1. pnpm Uses Symlinked node_modules — Some Tools Break

pnpm's isolated `node_modules` structure uses symlinks. Some older tools that use `require()` traversal or assume flat `node_modules` may fail:

```ini
# .npmrc — hoist problematic packages to root node_modules
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
public-hoist-pattern[]=*jest*
public-hoist-pattern[]=*babel*

# Or shamefully hoist everything (last resort — breaks pnpm isolation)
shamefully-hoist=true
```

## 2. `pnpm install --frozen-lockfile` for CI

In CI, always use frozen lockfile to prevent unintended upgrades:

```bash
pnpm install --frozen-lockfile

# Or set in .npmrc
prefer-frozen-lockfile=true
```

## 3. Workspace Protocols Must Match

```json
// ✅ Workspace package reference
{
  "dependencies": {
    "@myapp/ui": "workspace:*",     // Any version in workspace
    "@myapp/utils": "workspace:^",  // Compatible version
    "@myapp/core": "workspace:1.0.0" // Exact version
  }
}
```

## 4. `pnpm add` in Monorepo — Specify the Target Package

```bash
# ❌ Adds to root only (probably wrong in monorepo)
pnpm add react

# ✅ Add to workspace root (use -w flag)
pnpm add -w react

# ✅ Add to specific workspace
pnpm add react --filter @myapp/frontend

# ✅ Add to all workspaces
pnpm add react -r
```

## 5. `pnpm dlx` Is Like `npx` — Temporary Execution

```bash
# Run without installing
pnpm dlx create-next-app my-app
pnpm dlx shadcn@latest init

# NOT the same as pnpm exec (which runs from node_modules/.bin)
pnpm exec tsc  # runs local tsc
pnpm dlx tsc   # downloads and runs tsc temporarily
```

## 6. Lock File Should Always Be Committed

```
# ✅ Commit to git
pnpm-lock.yaml

# ❌ Never gitignore your lockfile!
```

## 7. `pnpm update` vs `pnpm update --latest`

```bash
# Updates within semver ranges (safe)
pnpm update

# Ignores semver — updates to absolute latest (potentially breaking)
pnpm update --latest

# Update specific package
pnpm update react --latest
```

## 8. Build Scripts Are Blocked by Default (pnpm 10+)

In pnpm 10+, packages cannot run `postinstall` scripts by default unless explicitly allowed:

```yaml
# pnpm-workspace.yaml or .npmrc
onlyBuiltDependencies:
  - sharp
  - esbuild
  - better-sqlite3
  - node-gyp
  - fsevents
```

If a package silently fails to install (e.g., native binaries), check if it needs to be added here.

## 9. `node_modules/.bin` Binaries May Not Be Accessible Globally

In strict mode, only direct dependencies' binaries are accessible:

```bash
# ❌ May fail if typescript is not a direct dependency
npx tsc

# ✅ Use pnpm exec which handles workspace resolution
pnpm exec tsc
# or
./node_modules/.bin/tsc
```

## 10. Catalog Pins Must Match Across Workspace

When using catalogs, all packages referencing `catalog:` get the same version. Make sure the version is compatible across all packages:

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^19.0.0  # All packages using catalog:react get ^19.0.0

# If one package needs React 18 and another needs 19, DON'T use catalog:
# Use named catalogs instead:
catalogs:
  legacy:
    react: ^18.0.0
  latest:
    react: ^19.0.0
```

## 11. `pnpm store prune` to Reclaim Disk Space

pnpm's content-addressable store grows over time:

```bash
# Remove unreferenced packages from store
pnpm store prune

# Check store size
pnpm store path  # Shows store location
du -sh $(pnpm store path)
```
