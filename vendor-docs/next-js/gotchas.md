# Next.js — Gotchas & Common Mistakes

<!-- Source: https://github.com/vercel/next.js (Context7: /vercel/next.js) -->

## 1. Server vs Client Component Confusion

**Problem:** Using hooks (`useState`, `useEffect`) or browser APIs in Server Components.

**Fix:** Add `'use client'` at the top of the file.

```typescript
// ❌ Fails — hooks not allowed in Server Components
export default function Counter() {
  const [count, setCount] = useState(0) // Error!
  return <div>{count}</div>
}

// ✅ Correct
'use client'
export default function Counter() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}
```

## 2. Missing `await` on `params` in Next.js 15

In Next.js 15, `params` and `searchParams` are now **Promises**:

```typescript
// ❌ Next.js 14 style — breaks in 15
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>
}

// ✅ Next.js 15 style
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <div>{id}</div>
}
```

## 3. GET Route Handlers No Longer Cached by Default (Next.js 15)

In Next.js 15, GET route handlers are **not cached** by default. Opt in explicitly:

```typescript
export const dynamic = 'force-static'

export async function GET() {
  return Response.json({ time: Date.now() })
}
```

## 4. `server-only` Package for Preventing Client Leaks

Protect server-only modules from being imported in client code:

```bash
npm install server-only
```

```typescript
// lib/db.ts
import 'server-only' // Will throw at build time if imported in client

export async function getUser() { /* ... */ }
```

## 5. Dynamic Imports for Code Splitting

Large dependencies should be dynamically imported:

```typescript
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false, // Disable SSR for browser-only code
})
```

## 6. Images Must Have Width/Height (or `fill`)

```typescript
// ❌ Missing dimensions
<Image src="/hero.jpg" alt="Hero" />

// ✅ Explicit dimensions
<Image src="/hero.jpg" alt="Hero" width={800} height={400} />

// ✅ Or fill mode (parent must be relative + have dimensions)
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <Image src="/hero.jpg" alt="Hero" fill objectFit="cover" />
</div>
```

## 7. Env Variables Not Available in Client Without `NEXT_PUBLIC_` Prefix

```bash
# ❌ Only available server-side
SECRET_KEY=abc123

# ✅ Available on client AND server
NEXT_PUBLIC_API_URL=https://api.example.com
```

## 8. Turbopack vs Webpack

Next.js 15 uses **Turbopack** by default in dev mode. Some webpack plugins/loaders are not yet compatible. To use webpack:

```bash
next dev --turbopack=false
```

## 9. `useRouter` from Wrong Package

```typescript
// ❌ Pages Router import — doesn't work in App Router
import { useRouter } from 'next/router'

// ✅ App Router import
import { useRouter } from 'next/navigation'
```

## 10. Forgetting to Handle Loading States with Suspense

```typescript
// app/page.tsx
import { Suspense } from 'react'
import SlowComponent from './SlowComponent'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SlowComponent />
    </Suspense>
  )
}
```

## 11. Static Generation with Dynamic Routes Requires `generateStaticParams`

```typescript
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({ slug: post.slug }))
}
```

## 12. Middleware Runs on Edge Runtime — No Node.js APIs

Middleware cannot use `fs`, `path`, or other Node.js-specific APIs. Use `NextResponse` only.
