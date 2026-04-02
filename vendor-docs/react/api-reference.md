# React — API Reference (Hooks)

<!-- Source: https://github.com/reactjs/react.dev (Context7: /reactjs/react.dev) -->

## useState

```typescript
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)         // number
  const [name, setName] = useState('')           // string
  const [user, setUser] = useState<User | null>(null)  // nullable

  // Update directly
  setCount(42)

  // Update based on previous value (preferred for derived updates)
  setCount(prev => prev + 1)

  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

## useEffect

```typescript
import { useState, useEffect } from 'react'

function ChatRoom({ roomId, serverUrl }: { roomId: string; serverUrl: string }) {
  useEffect(() => {
    // Setup
    const connection = createConnection(serverUrl, roomId)
    connection.connect()

    // Cleanup (runs before next effect and on unmount)
    return () => {
      connection.disconnect()
    }
  }, [serverUrl, roomId])  // Dependencies

  // Empty deps: run only once on mount
  useEffect(() => {
    console.log('mounted')
    return () => console.log('unmounted')
  }, [])

  // No deps array: run after every render
  useEffect(() => {
    console.log('after every render')
  })
}
```

## useContext

```typescript
import { createContext, useContext } from 'react'

interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

// Provider
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  return (
    <ThemeContext value={{ theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>
      {children}
    </ThemeContext>
  )
}

// Consumer
function ThemedButton() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('Must be used inside ThemeProvider')
  const { theme, toggleTheme } = context
  return <button onClick={toggleTheme}>Theme: {theme}</button>
}
```

## useReducer

```typescript
import { useReducer } from 'react'

type State = { count: number; error: string | null }
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + 1 }
    case 'decrement': return { ...state, count: state.count - 1 }
    case 'reset': return { count: 0, error: null }
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0, error: null })

  return (
    <div>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <span>{state.count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
    </div>
  )
}
```

## useRef

```typescript
import { useRef, useEffect } from 'react'

function TextInput() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return <input ref={inputRef} type="text" />
}

// Mutable ref (won't cause re-render)
function Timer() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const start = () => {
    intervalRef.current = setInterval(() => console.log('tick'), 1000)
  }

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }
}
```

## useMemo

```typescript
import { useMemo } from 'react'

function ExpensiveList({ items, filter }: { items: Item[]; filter: string }) {
  // Only re-computed when items or filter changes
  const filteredItems = useMemo(() => {
    return items.filter(item => item.name.includes(filter))
  }, [items, filter])

  return <ul>{filteredItems.map(item => <li key={item.id}>{item.name}</li>)}</ul>
}
```

## useCallback

```typescript
import { useCallback } from 'react'

function Parent({ id }: { id: string }) {
  const [count, setCount] = useState(0)

  // Stable function reference — won't cause child re-renders
  const handleSubmit = useCallback(async (data: FormData) => {
    await submitData(id, data)
  }, [id])  // Only recreated when id changes

  return <ChildForm onSubmit={handleSubmit} />
}
```

## Custom Hooks

```typescript
// Convention: hook name must start with 'use'
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Usage in any component
function StatusBadge() {
  const isOnline = useOnlineStatus()
  return <span>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
}
```

## useTransition (React 18+)

```typescript
import { useTransition, useState } from 'react'

function SearchPage() {
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')

  const handleChange = (value: string) => {
    // Non-urgent update — can be interrupted
    startTransition(() => {
      setQuery(value)
    })
  }

  return (
    <div>
      <input onChange={e => handleChange(e.target.value)} />
      {isPending ? <Spinner /> : <SearchResults query={query} />}
    </div>
  )
}
```

## React 19: use() Hook

```typescript
import { use, Suspense } from 'react'

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise)  // Suspends until resolved
  return <div>{user.name}</div>
}

function Page() {
  const userPromise = fetchUser()
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  )
}
```

## Rules of Hooks

1. **Only call hooks at the top level** — not inside loops, conditions, or nested functions
2. **Only call hooks from React function components or custom hooks** — not from regular functions

```typescript
// ❌ Conditional hook call
if (condition) {
  const [value, setValue] = useState(0)  // Error!
}

// ✅ Condition inside the hook
const [value, setValue] = useState(0)
if (condition) {
  // Use value here
}
```
