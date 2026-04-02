# SWR — API Reference

<!-- Source: https://github.com/vercel/swr-site (Context7: /vercel/swr-site) -->

## useSWR Hook

```typescript
const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher?, options?)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string \| null \| () => string \| [...]` | Cache key. `null` disables fetching |
| `fetcher` | `(key) => Promise<T>` | Async function to fetch data |
| `options` | `object` | Configuration options |

### Return Values

| Value | Type | Description |
|-------|------|-------------|
| `data` | `T \| undefined` | Fetched data, `undefined` while loading |
| `error` | `any` | Error from fetcher, `undefined` on success |
| `isLoading` | `boolean` | First load in progress (no cached data) |
| `isValidating` | `boolean` | Any request/revalidation in progress |
| `mutate` | `function` | Manually update/revalidate |

### Key Options

```typescript
useSWR('/api/data', fetcher, {
  // Revalidation
  revalidateOnMount: true,       // Revalidate on component mount
  revalidateOnFocus: true,       // Revalidate on window focus
  revalidateOnReconnect: true,   // Revalidate on network reconnect
  revalidateIfStale: true,       // Revalidate even if stale data exists
  refreshInterval: 0,            // Polling interval (ms), 0 = disabled
  refreshWhenHidden: false,      // Poll when tab hidden
  refreshWhenOffline: false,     // Poll when offline

  // Caching
  dedupingInterval: 2000,        // Deduplicate same-key requests (ms)
  focusThrottleInterval: 5000,   // Throttle focus events (ms)

  // Data
  fallbackData: undefined,       // Initial data for this hook
  keepPreviousData: false,       // Show prev data while loading new

  // Retries
  shouldRetryOnError: true,      // Retry on error
  errorRetryCount: 3,            // Max retries
  errorRetryInterval: 5000,      // Retry interval (ms)

  // Callbacks
  onSuccess: (data, key, config) => { },
  onError: (err, key, config) => { },
  onLoadingSlow: (key, config) => { },

  // Suspend mode (React Suspense)
  suspense: false,
})
```

## Conditional Fetching

```typescript
// Don't fetch if userId is null/undefined/false
const { data } = useSWR(userId ? `/api/user/${userId}` : null, fetcher)

// Function key (throws = don't fetch)
const { data } = useSWR(
  () => {
    if (!user) throw new Error('Not authenticated')
    return `/api/posts?userId=${user.id}`
  },
  fetcher
)

// Array key (when all parts are ready)
const { data } = useSWR(
  userId && token ? ['/api/user', userId, token] : null,
  ([url, id, tok]) => fetchUser(url, id, tok)
)
```

## Mutation

```typescript
import useSWR, { mutate } from 'swr'

function UserProfile({ userId }) {
  const { data, mutate } = useSWR(`/api/user/${userId}`, fetcher)

  async function updateName(newName: string) {
    // Optimistic update
    mutate({ ...data, name: newName }, false)  // false = don't revalidate yet

    // Send to server
    await updateUserName(userId, newName)

    // Revalidate
    mutate()
  }

  // Mutate with async function
  async function saveAvatar(file: File) {
    await mutate(async (currentData) => {
      const url = await uploadAvatar(file)
      return { ...currentData, avatar: url }
    })
  }
}

// Global mutate (outside component)
import { mutate } from 'swr'

await mutate('/api/user/123')               // Revalidate
await mutate('/api/user/123', newData)      // Update + revalidate
await mutate('/api/user/123', newData, false) // Update, no revalidate
```

## useSWRMutation (For Write Operations)

```typescript
import useSWRMutation from 'swr/mutation'

async function updateUser(url: string, { arg }: { arg: { name: string } }) {
  return fetch(url, {
    method: 'PATCH',
    body: JSON.stringify(arg),
  }).then(res => res.json())
}

function Profile({ userId }: { userId: string }) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/user/${userId}`,
    updateUser
  )

  return (
    <button
      onClick={() => trigger({ name: 'Alice' })}
      disabled={isMutating}
    >
      {isMutating ? 'Saving...' : 'Update Name'}
    </button>
  )
}
```

## useSWRInfinite (Pagination)

```typescript
import useSWRInfinite from 'swr/infinite'

function PostList() {
  const { data, size, setSize, isLoading } = useSWRInfinite(
    (pageIndex, previousData) => {
      if (previousData && !previousData.length) return null  // End of pages
      return `/api/posts?page=${pageIndex + 1}`
    },
    fetcher
  )

  const allPosts = data ? data.flat() : []

  return (
    <div>
      {allPosts.map(post => <Post key={post.id} {...post} />)}
      <button onClick={() => setSize(size + 1)}>Load More</button>
    </div>
  )
}
```

## Revalidation Strategies

```typescript
// Stale-while-revalidate: show stale, fetch fresh in background
const { data } = useSWR('/api/data', fetcher)

// Cache-first: don't revalidate if data is fresh
const { data } = useSWR('/api/data', fetcher, {
  revalidateOnFocus: false,
  revalidateIfStale: false,
})

// Network-only: always fetch
const { data } = useSWR('/api/data', fetcher, {
  revalidateOnMount: true,
  revalidateIfStale: true,
  refreshInterval: 30_000,  // Also poll every 30s
})
```
