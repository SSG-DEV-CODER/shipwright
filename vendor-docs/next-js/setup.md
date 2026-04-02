# Next.js — Setup & Installation

<!-- Source: https://github.com/vercel/next.js (Context7: /vercel/next.js) -->

## Quick Start

Create a new Next.js app:

```bash
npx create-next-app@latest my-app
cd my-app
```

You will be prompted to choose TypeScript, ESLint, Tailwind CSS, src/ directory, App Router, etc.

## Manual Installation

Install latest Next.js, React, and React DOM:

```bash
# npm
npm install next@latest react@latest react-dom@latest eslint-config-next@latest

# pnpm
pnpm add next@latest react@latest react-dom@latest eslint-config-next@latest

# yarn
yarn add next@latest react@latest react-dom@latest eslint-config-next@latest

# bun
bun add next@latest react@latest react-dom@latest eslint-config-next@latest
```

## package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

Start the development server (uses Turbopack by default):

```bash
pnpm dev
# or
npm run dev
```

## Directory Structure (App Router)

```
my-app/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page (/)
│   └── globals.css
├── public/              # Static assets
├── next.config.js       # Next.js config
├── tsconfig.json
└── package.json
```

## Basic next.config.js

```javascript
// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
}

module.exports = nextConfig
```

## Route Handler (API Endpoint)

```typescript
// app/api/hello/route.ts
export function GET(request: Request) {
  return Response.json({ message: 'Hello World' })
}
```

## Tailwind CSS in Next.js

```bash
pnpm add -D tailwindcss @tailwindcss/postcss
```

Then in your `postcss.config.js`:

```js
export default {
  plugins: ["@tailwindcss/postcss"],
}
```

And in your global CSS:

```css
@import "tailwindcss";
```

## Self-Hosting

For standalone output (Docker-friendly):

```javascript
// next.config.js
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

Start production server:

```bash
node .next/standalone/server.js
# Or with custom port/hostname:
PORT=8080 HOSTNAME=0.0.0.0 node server.js
```
