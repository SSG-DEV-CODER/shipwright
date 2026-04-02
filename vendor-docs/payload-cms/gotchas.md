# Payload CMS — Gotchas & Common Mistakes

<!-- Source: https://github.com/payloadcms/payload (Context7: /payloadcms/payload) -->

## 1. All Package Versions Must Match in v3

Unlike v2, all `@payloadcms/*` packages must be on the same version:

```bash
# ✅ All synchronized
pnpm i payload@3.x @payloadcms/next@3.x @payloadcms/richtext-lexical@3.x @payloadcms/db-postgres@3.x
```

Mismatched versions cause silent failures and type errors.

## 2. `sharp` Must Be Explicitly Installed and Configured

In Payload v3, `sharp` is no longer auto-detected:

```bash
pnpm i sharp
```

```typescript
// payload.config.ts
import sharp from 'sharp'

export default buildConfig({
  sharp, // Must be explicitly passed
  // ...
})
```

## 3. `PAYLOAD_SECRET` Must Be a Strong Random String

```bash
# Generate a secure secret
openssl rand -base64 32
```

```bash
# .env
PAYLOAD_SECRET=your-64-char-random-string-here
```

Weak or short secrets lead to security vulnerabilities in JWT tokens.

## 4. Database Migrations Must Run Before Build in CI

```json
{
  "scripts": {
    "ci": "payload migrate && pnpm build"
  }
}
```

Skipping migrations on a production database causes schema drift.

## 5. `getPayload` Creates a New Instance — Cache It

```typescript
// ❌ Creates a new instance every time (slow)
export async function getPosts() {
  const payload = await getPayload({ config })
  return payload.find({ collection: 'posts' })
}

// ✅ Better: use Next.js cache or singleton pattern
import { cache } from 'react'

const getPayloadClient = cache(async () => {
  const payload = await getPayload({ config })
  return payload
})
```

## 6. Relationships Are Not Auto-Populated (depth=0 by default)

```typescript
// ❌ Returns author as just an ID string
const post = await payload.findByID({ collection: 'posts', id })
post.author // "64abc123" (just ID)

// ✅ Use depth to populate
const post = await payload.findByID({
  collection: 'posts',
  id,
  depth: 1,  // Populate one level of relationships
})
post.author // { id: '64abc123', name: 'Jane', email: '...' }
```

## 7. Access Control is Required for Security

By default, collections may be too permissive. Always define access:

```typescript
export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  // ...
}
```

## 8. Admin Panel Path Conflicts

If you have other routes under `/admin`, they will conflict with Payload's admin panel which lives at `/admin`. Use route groups:

```
app/
├── (app)/          # Your application routes
│   └── page.tsx
└── (payload)/      # Payload admin
    └── admin/[[...segments]]/
```

## 9. `withPayload` Wrapper Required in next.config

```javascript
// ❌ Missing wrapper
const nextConfig = {}
export default nextConfig

// ✅ Required for Payload to work
import { withPayload } from '@payloadcms/next/withPayload'
const nextConfig = {}
export default withPayload(nextConfig)
```

## 10. File Uploads Require `staticDir` and Proper Next.js Config

```typescript
// Collection
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: path.resolve(dirname, '../public/media'),
  },
}
```

```javascript
// next.config.js — serve uploaded files
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
}
```

## 11. GraphQL Requires Explicit Dependency

```bash
pnpm add graphql   # peer dependency
pnpm add -D @payloadcms/graphql
```

```typescript
export default buildConfig({
  graphQL: {
    schemaOutputFile: './schema.graphql',
  },
})
```

## 12. Lexical Editor Requires Its Own Package

```bash
pnpm i @payloadcms/richtext-lexical
```

```typescript
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export default buildConfig({
  editor: lexicalEditor({}),
})
```
