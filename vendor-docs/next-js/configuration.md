# Next.js — Configuration

<!-- Source: https://github.com/vercel/next.js (Context7: /vercel/next.js) -->

## next.config.js Options

```javascript
// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output mode: 'standalone' for Docker
  output: 'standalone',

  // React strict mode
  reactStrictMode: true,

  // Image domains
  images: {
    domains: ['example.com'],
  },

  // Redirect config
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ]
  },

  // Custom headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ]
  },

  // Environment variables (exposed to browser)
  env: {
    CUSTOM_KEY: 'value',
  },
}

module.exports = nextConfig
```

## TypeScript next.config.ts (Next.js 15+)

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
}

export default nextConfig
```

## ESLint Configuration

Install ESLint:

```bash
pnpm add -D eslint eslint-config-next
```

`.eslintrc.json`:

```json
{
  "extends": "next/core-web-vitals"
}
```

Or `eslint.config.mjs` (flat config):

```javascript
import nextConfig from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextConfig,
]

export default eslintConfig
```

## TypeScript tsconfig.json (Next.js App Router)

```json
{
  "compilerOptions": {
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
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Environment Variables

- `.env.local` — local overrides (gitignored)
- `.env.development` — dev defaults
- `.env.production` — prod defaults
- `.env` — all environments

Prefix with `NEXT_PUBLIC_` to expose to the browser:

```bash
# .env.local
DATABASE_URL=postgres://...
NEXT_PUBLIC_API_URL=https://api.example.com
```

Usage in code:

```typescript
// Server-side only
const dbUrl = process.env.DATABASE_URL

// Client-accessible
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

## Content Security Policy

```javascript
const isDev = process.env.NODE_ENV === 'development'

const cspHeader = `
    default-src 'self';
    script-src 'self'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```
