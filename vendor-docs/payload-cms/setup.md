# Payload CMS — Setup & Installation

<!-- Source: https://github.com/payloadcms/payload (Context7: /payloadcms/payload) -->

## Quick Start (New Project)

```bash
npx create-payload-app@latest
cd my-app
pnpm dev
```

Or from a template:

```bash
npx create-payload-app --example example_name
```

## Install into Existing Next.js App

```bash
# Core packages
pnpm i payload @payloadcms/next

# Choose a database adapter
pnpm i @payloadcms/db-postgres   # PostgreSQL (recommended)
# or
pnpm i @payloadcms/db-mongodb    # MongoDB

# Optional but common
pnpm i @payloadcms/richtext-lexical sharp graphql
```

## Minimum package.json scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo --no-server-fast-refresh",
    "build": "next build",
    "payload": "cross-env NODE_OPTIONS=--no-deprecation payload",
    "ci": "payload migrate && pnpm build"
  }
}
```

## Environment Variables

```bash
# .env
PAYLOAD_SECRET=your-random-secret-string
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
# or MongoDB:
# DATABASE_URL=mongodb://127.0.0.1/my-payload-app
```

## Basic payload.config.ts

```typescript
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  editor: lexicalEditor({}),
  sharp,
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [
        { name: 'name', type: 'text' },
      ],
    },
    {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'content', type: 'richText' },
      ],
    },
  ],
  admin: {
    user: 'users',
  },
})
```

## Next.js Integration

In `next.config.js`, wrap with Payload's Next.js config helper:

```javascript
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withPayload(nextConfig)
```

## Directory Structure

```
my-app/
├── src/
│   ├── app/
│   │   ├── (payload)/          # Payload admin panel routes
│   │   │   └── admin/[[...segments]]/
│   │   └── (app)/              # Your app routes
│   ├── collections/            # Collection configs
│   └── payload.config.ts       # Main Payload config
├── .env
└── package.json
```

## Development Server

```bash
pnpm dev
# Access admin at: http://localhost:3000/admin
# Default credentials: demo@payloadcms.com / demo (seeded)
```

## Production Build

```bash
pnpm build
pnpm start
```
