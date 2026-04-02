# pnpm — Configuration Reference

<!-- Source: https://pnpm.io (Context7: /websites/pnpm_io) -->

## .npmrc File

Located at project root or `~/.npmrc` (global):

```ini
# Store directory (where packages are cached)
store-dir=~/.pnpm-store

# Peer dependencies
auto-install-peers=true

# Lockfile behavior
prefer-frozen-lockfile=true    # CI: fail if lockfile is out of date
frozen-lockfile=false          # Dev: update lockfile as needed

# Hoisting (for compatibility with tools that expect flat node_modules)
shamefully-hoist=false         # Keep strict isolation
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
public-hoist-pattern[]=*types*

# Registry
registry=https://registry.npmjs.org/

# Link workspace packages
link-workspace-packages=true

# Save prefix
save-prefix=^
```

## pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/node_modules'    # Exclude node_modules

# Catalog: pin shared versions across workspace
catalog:
  react: ^19.0.0
  typescript: ^5.0.0
  next: ^15.0.0
```

## pnpm Settings Reference

### Dependency Behavior

```yaml
# Auto-install missing peer dependencies
autoInstallPeers: true

# Packages that CAN run install scripts (whitelist)
onlyBuiltDependencies:
  - fsevents
  - sharp
  - esbuild

# Packages that CANNOT run install scripts (blacklist)
neverBuiltDependencies:
  - sqlite3

# Ignore packages from running scripts AND suppress warnings
ignoredBuiltDependencies:
  - node-gyp

# Check node_modules before running scripts
verifyDepsBeforeRun: install    # auto-install if out of date
# verifyDepsBeforeRun: warn     # warn
# verifyDepsBeforeRun: error    # fail
```

### Store Configuration

```yaml
# Where packages are cached
storeDir: "/my/custom/store/path"

# Verify package integrity
verifyStoreIntegrity: true

# Enable global virtual store (experimental)
enableGlobalVirtualStore: false
```

### Workspace Settings

```yaml
# Link workspace packages when possible
linkWorkspacePackages: true
# linkWorkspacePackages: deep   # Also link subdependencies

# Hard-link all local workspace deps
injectWorkspacePackages: false

# Prefer workspace versions over registry
preferWorkspacePackages: false

# When circular deps are OK
ignoreWorkspaceCycles: false
```

## Config Command

```bash
# Get a config value
pnpm config get registry
pnpm config get --json onlyBuiltDependencies

# Set a config value
pnpm config set --location=project registry https://registry.npmjs.org
pnpm config set save-prefix="~"

# Get path to global config file
pnpm config get globalconfig
```

## Catalog Feature (pnpm 9+)

Define shared dependency versions in workspace:

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^19.0.0
  "react-dom": ^19.0.0
  typescript: ^5.0.0

# Named catalogs
catalogs:
  react18:
    react: ^18.0.0
    react-dom: ^18.0.0
  react19:
    react: ^19.0.0
    react-dom: ^19.0.0
```

Reference in package.json:

```json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "some-react18-pkg": "catalog:react18"
  }
}
```

## Docker with pnpm

```dockerfile
FROM node:20-slim

RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install with frozen lockfile (CI mode)
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
```

## Troubleshooting

```bash
# Clear cache and reinstall
rm -rf node_modules
pnpm install

# Verify store integrity
pnpm store verify

# Prune unnecessary packages from store
pnpm store prune

# Check for duplicate packages
pnpm why react

# See why a package is installed
pnpm why lodash
```
