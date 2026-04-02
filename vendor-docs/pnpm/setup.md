# pnpm — Setup & Installation

<!-- Source: https://pnpm.io (Context7: /websites/pnpm_io) -->

## Installation

### Via npm (recommended)

```bash
npm install -g pnpm
```

### Via Corepack (Node.js 16.9+)

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Via standalone script

```bash
# Unix/macOS
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Windows PowerShell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

## Initialize a New Project

```bash
pnpm init
# or with bare package.json
pnpm init --bare
```

## Common Commands

```bash
# Install all dependencies
pnpm install
pnpm i  # shorthand

# Add a dependency
pnpm add react
pnpm add -D typescript    # devDependency
pnpm add -g nodemon       # global

# Remove a dependency
pnpm remove react

# Update dependencies
pnpm update
pnpm update react         # specific package
pnpm update --latest      # update to latest (ignores semver)

# Run scripts
pnpm run dev
pnpm dev       # shorthand for run
pnpm test
pnpm build

# Execute a package binary
pnpm dlx create-next-app   # like npx, temporary install
pnpm exec tsc              # run from node_modules/.bin

# List installed packages
pnpm list
pnpm list --depth=0        # top-level only

# Check for outdated packages
pnpm outdated

# Audit for vulnerabilities
pnpm audit
```

## Workspace Setup (Monorepo)

Create `pnpm-workspace.yaml` in project root:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```bash
# Install in workspace root only
pnpm add -w react

# Install in specific workspace
pnpm add react --filter @myapp/frontend

# Run command in all workspaces
pnpm -r run build

# Run command in filtered workspaces
pnpm --filter "@myapp/*" run build
```

## Pin pnpm Version in package.json

```json
{
  "packageManager": "pnpm@10.0.0"
}
```

## CI Setup

### GitHub Actions

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10

- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'

- run: pnpm install --frozen-lockfile
```

### Using Corepack in CI

```bash
npm install --global corepack@latest
corepack enable
corepack prepare pnpm@latest-10 --activate
pnpm install
```

## .npmrc Configuration

```ini
# .npmrc
store-dir=~/.pnpm-store
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
shamefully-hoist=false
auto-install-peers=true
prefer-frozen-lockfile=true
```
