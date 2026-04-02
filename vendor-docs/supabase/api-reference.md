# Supabase — API Reference

<!-- Source: https://github.com/supabase/supabase (Context7: /supabase/supabase) -->

## Database (PostgREST)

### Select

```typescript
// Select all rows
const { data, error } = await supabase
  .from('posts')
  .select('*')

// Select specific columns
const { data } = await supabase
  .from('posts')
  .select('id, title, created_at')

// Select with relations (join)
const { data } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    author:users(id, name, avatar_url)
  `)

// Filter
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(10)
  .range(0, 9)  // pagination

// Single row
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('id', postId)
  .single()
```

### Insert

```typescript
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'Hello', status: 'draft' })
  .select()
  .single()

// Insert many
const { data } = await supabase
  .from('posts')
  .insert([
    { title: 'Post 1' },
    { title: 'Post 2' },
  ])
  .select()
```

### Update

```typescript
const { data, error } = await supabase
  .from('posts')
  .update({ status: 'published' })
  .eq('id', postId)
  .select()
  .single()
```

### Upsert

```typescript
const { data } = await supabase
  .from('profiles')
  .upsert({ id: userId, username: 'alice' })
  .select()
```

### Delete

```typescript
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postId)
```

## Filter Operations

```typescript
.eq('column', value)       // Equal
.neq('column', value)      // Not equal
.gt('column', value)       // Greater than
.gte('column', value)      // Greater than or equal
.lt('column', value)       // Less than
.lte('column', value)      // Less than or equal
.like('column', '%val%')   // LIKE
.ilike('column', '%val%')  // Case-insensitive LIKE
.is('column', null)        // IS NULL
.in('column', [1, 2, 3])   // IN array
.contains('column', value) // Array contains
.range('column', '[1,10]') // Range query
.not('column', 'is', null) // NOT NULL
.or('status.eq.draft,status.eq.published')  // OR
```

## Authentication

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
})

// Sign in with email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
})

// Sign in with OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: 'http://localhost:3000/auth/callback',
  },
})

// Sign out
await supabase.auth.signOut()

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Get session
const { data: { session } } = await supabase.auth.getSession()

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log(event, session)
})
```

## Storage

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/avatar.jpg`, file, {
    cacheControl: '3600',
    upsert: false,
  })

// Get public URL
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${userId}/avatar.jpg`)

// Download file
const { data, error } = await supabase.storage
  .from('avatars')
  .download(`${userId}/avatar.jpg`)

// Delete file
await supabase.storage
  .from('avatars')
  .remove([`${userId}/avatar.jpg`])

// List files
const { data } = await supabase.storage
  .from('avatars')
  .list(userId)
```

## Realtime

```typescript
// Subscribe to table changes
const channel = supabase
  .channel('schema-db-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'posts' },
    (payload) => {
      console.log('Change received!', payload)
    }
  )
  .subscribe()

// Unsubscribe
supabase.removeChannel(channel)

// Broadcast messages
const channel = supabase.channel('room-1')
channel
  .on('broadcast', { event: 'cursor-pos' }, (payload) => {
    console.log(payload)
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({
        type: 'broadcast',
        event: 'cursor-pos',
        payload: { x: 10, y: 30 },
      })
    }
  })
```

## Edge Functions

```typescript
const { data, error } = await supabase.functions.invoke('hello-world', {
  body: { name: 'Functions' },
})
```

## TypeScript Types

Generate types from your database schema:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > database.types.ts
```

Use in client:

```typescript
import type { Database } from './database.types'

const supabase = createClient<Database>(url, key)

// Now fully typed
const { data } = await supabase
  .from('posts')
  .select('*')
// data is typed as Database['public']['Tables']['posts']['Row'][]
```
