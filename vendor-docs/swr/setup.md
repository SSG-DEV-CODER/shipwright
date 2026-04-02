# SWR — Setup & Getting Started

<!-- Source: https://github.com/vercel/swr-site (Context7: /vercel/swr-site) -->

## Installation

```bash
pnpm add swr
# or
npm install swr
# or
yarn add swr
```

## Basic Usage

```tsx
import useSWR from 'swr'

// Define a fetcher function
const fetcher = (url: string) => fetch(url).then(res => res.json())

function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading } = useSWR(`/api/user/${userId}`, fetcher)

  if (error) return <div>Failed to load</div>
  if (isLoading) return <div>Loading...</div>

  return <div>Hello, {data.name}!</div>
}
```

## Global Configuration

```tsx
// app/layout.tsx or _app.tsx
import { SWRConfig } from 'swr'

const globalFetcher = (url: string) => fetch(url).then(res => res.json())

export default function App({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher: globalFetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        shouldRetryOnError: true,
        dedupingInterval: 2000,    // ms
        refreshInterval: 0,        // 0 = disabled
      }}
    >
      {children}
    </SWRConfig>
  )
}
```

## Custom Hook Pattern

```typescript
// hooks/use-user.ts
import useSWR from 'swr'

interface User {
  id: string
  name: string
  email: string
  avatar: string
}

export function useUser(userId: string) {
  const { data, error, isLoading, mutate } = useSWR<User>(
    userId ? `/api/user/${userId}` : null,  // null key = don't fetch
    { revalidateOnFocus: false }
  )

  return {
    user: data,
    isLoading,
    isError: !!error,
    mutate,
  }
}

// Usage — NO prop drilling needed!
function Avatar({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId)
  if (isLoading) return <Spinner />
  return <img src={user?.avatar} alt={user?.name} />
}

function Content({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId)
  if (isLoading) return <Spinner />
  return <h1>Welcome back, {user?.name}</h1>
}

// Both components share the SAME request (deduplicated)
```

## TypeScript

```typescript
import useSWR from 'swr'

interface Post {
  id: string
  title: string
  content: string
}

// Typed fetcher
const fetcher = async (url: string): Promise<Post[]> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

// Typed hook
const { data, error } = useSWR<Post[]>('/api/posts', fetcher)
// data is Post[] | undefined
```

## Preloading Data

```typescript
import useSWR, { preload } from 'swr'

// Preload before component renders (e.g., on hover)
preload('/api/user', fetcher)

function UserProfile() {
  const { data } = useSWR('/api/user', fetcher)  // Reuses preloaded data
  return <div>{data?.name}</div>
}
```
