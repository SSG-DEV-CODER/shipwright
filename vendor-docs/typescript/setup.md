# TypeScript — Setup & Configuration

<!-- Source: https://github.com/microsoft/typescript-website (Context7: /microsoft/typescript-website) -->

## Installation

```bash
npm install -D typescript
# or
pnpm add -D typescript

# Initialize tsconfig
npx tsc --init
```

## Typical tsconfig.json for Next.js / Modern Web App

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

## tsconfig.json for Node.js

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationDir": "dist/types",
    "sourceMap": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## tsconfig.json for Bundler (Vite, Webpack, etc.)

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "allowArbitraryExtensions": true,
    "strict": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"]
  }
}
```

## Monorepo / Composite Projects

```json
// packages/frontend/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

```json
// tsconfig.json (root — solution style)
{
  "files": [],
  "references": [
    { "path": "./packages/frontend/tsconfig.json" },
    { "path": "./packages/backend/tsconfig.json" }
  ]
}
```

## Type Checking Commands

```bash
# Type check without emitting
npx tsc --noEmit

# Watch mode
npx tsc --noEmit --watch

# Build composite project
npx tsc --build
```

## Common Compiler Options Reference

| Option | Purpose |
|--------|---------|
| `strict` | Enable all strict checks (recommended) |
| `noImplicitAny` | Error on implicit `any` type |
| `strictNullChecks` | Enable null/undefined checks |
| `skipLibCheck` | Skip type checking .d.ts files |
| `moduleResolution` | How modules are resolved (`bundler`, `nodenext`) |
| `paths` | Path aliases (e.g., `@/` → `./src/`) |
| `outDir` | Output directory for compiled JS |
| `rootDir` | Root directory of source files |
| `declaration` | Generate .d.ts files |
| `sourceMap` | Generate source maps |
| `isolatedModules` | Required for Babel/esbuild compatibility |
| `verbatimModuleSyntax` | Ensures `import type` is used for type-only imports |
