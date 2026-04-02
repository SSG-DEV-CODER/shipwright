# SWR — Gotchas & Common Mistakes

<!-- Source: https://github.com/vercel/swr-site (Context7: /vercel/swr-site) -->

## 1. Keys Must Be Stable — Don't Use Objects/Arrays Directly

```typescript
// ❌ Creates a new array reference every render → infinite refetch
const { data } = useSWR(['/api/user', { id: userId }], fetcher)

// ✅ Serialize the key or use primitive values
const { data } = useSWR(`/api/user/${userId}`, fetcher)

// ✅ Or use a stable serialization
import { stableStringify } from 'some-lib'
const { data } = useSWR(stableStringify({ url: '/api/user', id: userId }), fetcher)
```

## 2. Null Key = Disabled (Don't Fetch)

```typescript
// null key disables fetching entirely
const { data } = useSWR(userId ? `/api/user/${userId}` : null, fetcher)
// data is undefined until userId is truthy
```

## 3. The Fetcher Must Throw on Error

```typescript
// ❌ Doesn't set error state — SWR won't know it failed
const fetcher = async (url: string) => {
  const res = await fetch(url)
  return res.json()  // Returns error JSON as "data"!
}

// ✅ Throw when response is not ok
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('Fetch failed')
    error.status = res.status
    throw error
  }
  return res.json()
}
```

## 4. `mutate` Without Arguments Triggers Revalidation

```typescript
const { data, mutate } = useSWR('/api/user', fetcher)

// Optimistic update WITHOUT revalidation (second arg = false)
mutate({ ...data, name: 'Alice' }, false)

// Update and ALSO revalidate (default behavior)
mutate({ ...data, name: 'Alice' })

// Just revalidate (refetch from server)
mutate()
```

## 5. Global `mutate` Needs the Same Key

```typescript
import { mutate } from 'swr'

// Must use the EXACT same key string as the useSWR call
mutate('/api/user/123')

// Mutate all keys matching a pattern
mutate(key => typeof key === 'string' && key.startsWith('/api/user'))
```

## 6. `revalidateOnFocus` May Cause Unexpected Refetches

When users switch browser tabs and return, SWR refetches by default. Disable if data doesn't change often:

```typescript
const { data } = useSWR('/api/config', fetcher, {
  revalidateOnFocus: false,   // Don't refetch on tab focus
  revalidateIfStale: false,   // Don't refetch if data exists
})
```

## 7. Data is `undefined` on First Load — Always Check

```typescript
// ❌ Assumes data is always present
function Profile() {
  const { data } = useSWR('/api/user', fetcher)
  return <div>{data.name}</div>  // TypeError if data is undefined!
}

// ✅ Handle loading state
function Profile() {
  const { data, isLoading, error } = useSWR('/api/user', fetcher)
  if (error) return <div>Error: {error.message}</div>
  if (isLoading) return <div>Loading...</div>
  return <div>{data.name}</div>
}
```

## 8. `isLoading` vs `isValidating`

```typescript
const { isLoading, isValidating } = useSWR('/api/data', fetcher)

// isLoading: true only for the FIRST load (no cached data yet)
// isValidating: true whenever any request is in-flight (including background refetches)

// Show spinner only on initial load:
if (isLoading) return <Spinner />

// Show subtle indicator on background updates:
{isValidating && <small>Refreshing...</small>}
```

## 9. `keepPreviousData` Prevents Flash of Empty State

```typescript
// ❌ Content disappears when key changes (e.g., pagination)
const { data } = useSWR(`/api/posts?page=${page}`, fetcher)

// ✅ Show previous data while loading new data
const { data } = useSWR(`/api/posts?page=${page}`, fetcher, {
  keepPreviousData: true,
})
```

## 10. SWR Doesn't Work Well for One-Time Mutations

For write operations (POST, PATCH, DELETE), use `useSWRMutation` instead:

```typescript
import useSWRMutation from 'swr/mutation'

// ✅ For write operations
const { trigger, isMutating } = useSWRMutation('/api/posts', createPost)

// useSWR is for READ operations
// useSWRMutation is for WRITE operations
```
