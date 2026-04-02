# Next.js — API Reference

<!-- Source: https://github.com/vercel/next.js (Context7: /vercel/next.js) -->

## App Router File Conventions

| File | Description |
|------|-------------|
| `app/layout.tsx` | Root layout, wraps all pages |
| `app/page.tsx` | Route page component |
| `app/loading.tsx` | Loading UI (Suspense boundary) |
| `app/error.tsx` | Error UI |
| `app/not-found.tsx` | 404 page |
| `app/route.ts` | API route handler |
| `app/[slug]/page.tsx` | Dynamic route |
| `app/(group)/page.tsx` | Route group (no URL segment) |

## Server Components vs Client Components

By default, all components in App Router are **Server Components**.

Add `'use client'` to opt into Client Components:

```typescript
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

## Data Fetching (Server Component)

```typescript
// app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }, // ISR: revalidate every hour
  })
  return res.json()
}

export default async function PostsPage() {
  const posts = await getPosts()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

## Route Handlers

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('query')
  return NextResponse.json({ users: [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return NextResponse.json({ created: true }, { status: 201 })
}
```

## Dynamic Route Handlers

```typescript
// app/api/users/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return Response.json({ userId: id })
}
```

## Middleware

```typescript
// middleware.ts (at project root)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Redirect unauthenticated users
  if (!request.cookies.get('token')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*'],
}
```

## Server Actions

```typescript
// app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  // Save to database
  return { success: true }
}
```

```typescript
// app/create/page.tsx
import { createPost } from '../actions'

export default function CreatePage() {
  return (
    <form action={createPost}>
      <input name="title" type="text" />
      <button type="submit">Create</button>
    </form>
  )
}
```

## Metadata API

```typescript
// app/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My App',
  description: 'My app description',
}
```

Dynamic metadata:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.id)
  return { title: post.title }
}
```

## Image Optimization

```typescript
import Image from 'next/image'

export default function Page() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero image"
      width={800}
      height={400}
      priority
    />
  )
}
```

## Navigation

```typescript
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Declarative navigation
<Link href="/about">About</Link>

// Programmatic navigation (Client Component only)
const router = useRouter()
router.push('/dashboard')
router.replace('/login')
router.back()
```

## Static vs Dynamic Rendering

```typescript
// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Force static rendering
export const dynamic = 'force-static'

// Revalidation period
export const revalidate = 3600 // seconds
```
