# React — Gotchas & Common Mistakes

<!-- Source: https://github.com/reactjs/react.dev (Context7: /reactjs/react.dev) -->

## 1. Stale Closure in useEffect

```typescript
// ❌ Stale closure — count is captured at 0
useEffect(() => {
  const timer = setInterval(() => {
    setCount(count + 1)  // Always adds 1 to the stale initial value
  }, 1000)
  return () => clearInterval(timer)
}, [])  // count not in deps

// ✅ Use functional update
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1)  // Uses current value
  }, 1000)
  return () => clearInterval(timer)
}, [])
```

## 2. Missing useEffect Cleanup

```typescript
// ❌ Memory leak — event listener never removed
useEffect(() => {
  window.addEventListener('resize', handleResize)
}, [])

// ✅ Always return cleanup function
useEffect(() => {
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])
```

## 3. Object/Array in useEffect Dependencies Causes Infinite Loop

```typescript
// ❌ config is a new object every render → infinite loop
function Component({ userId }) {
  useEffect(() => {
    fetchData({ userId })
  }, [{ userId }])  // New object every render!
}

// ✅ Use primitives in deps
function Component({ userId }) {
  useEffect(() => {
    fetchData({ userId })
  }, [userId])
}
```

## 4. State Updates are Batched (React 18)

```typescript
// React 18 batches ALL updates, even in async functions
async function handleClick() {
  setCount(c => c + 1)
  setLoading(false)  // These are batched into ONE render
}

// To force synchronous rendering (rarely needed):
import { flushSync } from 'react-dom'
flushSync(() => {
  setCount(c => c + 1)
})
// DOM updated here
```

## 5. useEffect Runs Twice in React 18 StrictMode (Dev Only)

In development with `<StrictMode>`, effects run twice to detect side effects. This is intentional and won't happen in production.

```typescript
// Your effect MUST be idempotent / have proper cleanup
useEffect(() => {
  const connection = connect()
  return () => connection.disconnect()  // ← Must clean up properly
}, [])
```

## 6. Keys Must Be Stable Unique IDs

```typescript
// ❌ Using index causes bugs with dynamic lists
{items.map((item, index) => (
  <Item key={index} {...item} />  // Don't use index for dynamic lists
))}

// ✅ Use stable unique ID
{items.map(item => (
  <Item key={item.id} {...item} />
))}
```

## 7. Don't Derive State from Props (Sync Them Instead)

```typescript
// ❌ State derived from props that can change
function Component({ userId }) {
  const [id, setId] = useState(userId)  // Won't update when userId changes!
}

// ✅ Use the prop directly
function Component({ userId }) {
  // Just use userId directly
  return <div>{userId}</div>
}

// Or reset when key changes
function Parent() {
  return <Component key={userId} userId={userId} />
}
```

## 8. useCallback/useMemo Are Not Always Necessary

Over-memoization adds complexity without benefit. Only memoize when:
- A function is a dependency of another hook
- A component is wrapped in `React.memo` and the prop is a function/object
- A computation is genuinely expensive

## 9. Context Re-renders All Consumers

```typescript
// ❌ Every context consumer re-renders when ANY context value changes
const UserContext = createContext({ user: null, theme: 'light' })

// ✅ Split contexts by update frequency
const UserContext = createContext(null)
const ThemeContext = createContext('light')
```

## 10. Async Operations After Unmount

```typescript
// ❌ Can cause "Can't perform state update on unmounted component"
useEffect(() => {
  fetchData().then(data => setData(data))  // Component might unmount first
}, [])

// ✅ Use AbortController or ignore flag
useEffect(() => {
  let ignored = false
  fetchData().then(data => {
    if (!ignored) setData(data)
  })
  return () => { ignored = true }
}, [])
```

## 11. React 19: forwardRef No Longer Needed

```typescript
// React 19: ref is just a regular prop
function Input({ ref, ...props }) {
  return <input ref={ref} {...props} />
}

// No need for forwardRef
```
