# Supabase — Gotchas & Common Mistakes

<!-- Source: https://github.com/supabase/supabase (Context7: /supabase/supabase) -->

## 1. Use `@supabase/ssr` for Server-Side Rendering, Not `@supabase/auth-helpers`

The `@supabase/auth-helpers-nextjs` package is deprecated. Use:

```bash
pnpm add @supabase/ssr
```

## 2. Row Level Security (RLS) Must Be Enabled

By default, new tables have RLS disabled — all data is public!

```sql
-- Enable RLS on a table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own posts
CREATE POLICY "Users can read own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);

-- Allow insert for authenticated users
CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## 3. `.single()` Throws if Row Not Found

```typescript
// ❌ Throws PGRST116 error if no row found
const { data } = await supabase.from('posts').select().eq('id', id).single()

// ✅ Use .maybeSingle() if the row might not exist
const { data } = await supabase.from('posts').select().eq('id', id).maybeSingle()
// data is null if not found
```

## 4. Always Handle Errors

```typescript
// ❌ Ignoring errors
const { data } = await supabase.from('posts').select()

// ✅ Handle errors
const { data, error } = await supabase.from('posts').select()
if (error) throw error
```

## 5. Service Role Key Must NEVER Be in Client-Side Code

```typescript
// ❌ NEVER do this in browser code
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ✅ Service role only in server-side code
// Use in API routes, server actions, server components — NOT in 'use client' files
```

## 6. Auth Callback Route Required for OAuth

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(origin)
}
```

## 7. Realtime Subscriptions Need to Be Cleaned Up

```typescript
useEffect(() => {
  const channel = supabase.channel('changes').on(...)
  channel.subscribe()

  return () => {
    supabase.removeChannel(channel)  // ← Must clean up
  }
}, [])
```

## 8. Anon Key Restrictions — Not a Security Mechanism

The anon key is **public** and visible in browser. Security comes from RLS policies, not hiding the key. Anyone can make requests with the anon key — your RLS policies are your defense.

## 9. `getUser()` vs `getSession()` — Use `getUser()` for Auth

```typescript
// ❌ session.user can be spoofed (doesn't validate JWT with server)
const { data: { session } } = await supabase.auth.getSession()
const user = session?.user

// ✅ getUser() validates the JWT with the auth server (secure)
const { data: { user } } = await supabase.auth.getUser()
```

## 10. Local Development Requires Docker

```bash
# Docker must be running before:
supabase start
```

The local stack uses Docker for Postgres, GoTrue, PostgREST, etc.

## 11. Column Names Are Case-Sensitive in PostgREST

```typescript
// If column is named "createdAt" in Postgres
.select('createdAt')   // ✅
.select('createdat')   // ❌ Column not found

// Supabase convention: use snake_case
.select('created_at')  // ✅
```

## 12. Migrations Must Be Committed to Version Control

```bash
# After schema changes locally:
supabase db diff --file new_migration
git add supabase/migrations/
git commit -m "Add new_migration"
```

Don't make schema changes directly in the hosted dashboard without creating a migration file.
