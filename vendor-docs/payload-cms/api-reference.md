# Payload CMS — API Reference

<!-- Source: https://github.com/payloadcms/payload (Context7: /payloadcms/payload) -->

## Local API (Server-Side)

Use `getPayload()` to interact with Payload directly in Next.js server components and API routes:

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'

// In a Server Component
export default async function Page() {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'posts',
    where: {
      status: { equals: 'published' },
    },
    limit: 10,
    sort: '-publishedAt',
  })

  return <div>{docs.map(post => <h2 key={post.id}>{post.title}</h2>)}</div>
}
```

## CRUD Operations

```typescript
const payload = await getPayload({ config })

// Find many
const { docs, totalDocs, page, totalPages } = await payload.find({
  collection: 'posts',
  depth: 2,          // Populate relationships 2 levels deep
  limit: 20,
  page: 1,
  sort: '-createdAt',
  where: {
    status: { equals: 'published' },
  },
})

// Find one by ID
const post = await payload.findByID({
  collection: 'posts',
  id: '64abc123',
  depth: 1,
})

// Create
const newPost = await payload.create({
  collection: 'posts',
  data: {
    title: 'My Post',
    status: 'draft',
  },
})

// Update
const updated = await payload.update({
  collection: 'posts',
  id: '64abc123',
  data: { status: 'published' },
})

// Delete
await payload.delete({
  collection: 'posts',
  id: '64abc123',
})

// Count
const { totalDocs } = await payload.count({
  collection: 'posts',
  where: { status: { equals: 'published' } },
})
```

## Globals API

```typescript
// Read global
const settings = await payload.findGlobal({
  slug: 'site-settings',
})

// Update global
await payload.updateGlobal({
  slug: 'site-settings',
  data: { siteName: 'My Site' },
})
```

## REST API

Payload auto-generates REST endpoints at `/api/{collection-slug}`:

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/posts` | Find many |
| GET | `/api/posts/:id` | Find by ID |
| POST | `/api/posts` | Create |
| PATCH | `/api/posts/:id` | Update |
| DELETE | `/api/posts/:id` | Delete |
| GET | `/api/posts/count` | Count |
| POST | `/api/users/login` | Login |
| POST | `/api/users/logout` | Logout |
| GET | `/api/users/me` | Current user |

Example REST calls:

```bash
# Find published posts
GET /api/posts?where[status][equals]=published&limit=10&sort=-publishedAt

# Find with depth
GET /api/posts?depth=2

# Get count
GET /api/posts/count?where[status][equals]=published
```

## Authentication

```typescript
// Login via REST
const res = await fetch('/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email: 'user@example.com', password: 'pass' }),
})
const { user, token } = await res.json()

// Or via Local API (server-side)
const { user, token } = await payload.login({
  collection: 'users',
  data: { email: 'user@example.com', password: 'pass' },
})

// Get current user via REST with JWT
curl "http://localhost:3000/api/users/me" \
  -H "Authorization: Bearer eyJhbG..."
```

## Where Queries

```typescript
// Equals
where: { status: { equals: 'published' } }

// Not equals
where: { status: { not_equals: 'draft' } }

// In array
where: { status: { in: ['published', 'featured'] } }

// Greater than
where: { views: { greater_than: 100 } }

// Contains (text search)
where: { title: { contains: 'hello' } }

// AND conditions
where: {
  and: [
    { status: { equals: 'published' } },
    { views: { greater_than: 10 } },
  ]
}

// OR conditions
where: {
  or: [
    { status: { equals: 'published' } },
    { featured: { equals: true } },
  ]
}
```

## Custom Endpoints

```typescript
export const Posts: CollectionConfig = {
  slug: 'posts',
  endpoints: [
    {
      path: '/my-custom-endpoint',
      method: 'get',
      handler: async (req) => {
        return Response.json({ message: 'Hello from custom endpoint' })
      },
    },
  ],
  // ...
}
```
