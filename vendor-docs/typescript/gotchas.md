# TypeScript — Gotchas & Common Mistakes

<!-- Source: https://github.com/microsoft/typescript-website (Context7: /microsoft/typescript-website) -->

## 1. `strict: true` Enables Several Sub-Flags

```json
{
  "compilerOptions": {
    "strict": true
    // Equivalent to enabling all of:
    // "noImplicitAny": true
    // "strictNullChecks": true
    // "strictFunctionTypes": true
    // "strictBindCallApply": true
    // "strictPropertyInitialization": true
    // "noImplicitThis": true
    // "useUnknownInCatchVariables": true
    // "alwaysStrict": true
  }
}
```

Always enable `strict: true` — it catches the most bugs.

## 2. `any` Silently Disables Type Checking

```typescript
// ❌ Any escapes type safety
function processData(data: any) {
  data.nonExistentMethod()  // No error!
}

// ✅ Use unknown and narrow it
function processData(data: unknown) {
  if (typeof data === 'string') {
    data.toUpperCase()  // Now safe
  }
}
```

## 3. Non-Null Assertion `!` Can Cause Runtime Errors

```typescript
// ❌ Dangerous — if element is null, throws at runtime
const el = document.getElementById('app')!
el.textContent = 'Hello'  // Crashes if #app doesn't exist

// ✅ Proper null check
const el = document.getElementById('app')
if (el) {
  el.textContent = 'Hello'
}
```

## 4. Type Assertions Don't Validate at Runtime

```typescript
// ❌ TypeScript believes you, but this is wrong at runtime
const user = JSON.parse(data) as User
// user.name might be undefined if data doesn't have it

// ✅ Validate with a type guard or library (e.g., zod)
import { z } from 'zod'
const UserSchema = z.object({ name: z.string() })
const user = UserSchema.parse(JSON.parse(data))  // Validates at runtime
```

## 5. `moduleResolution: "bundler"` vs `"node"`

For modern bundlers (Vite, esbuild, webpack), use `"bundler"`. For native Node.js ESM use `"nodenext"`:

```json
// For Vite/webpack projects
{ "moduleResolution": "bundler" }

// For Node.js ESM projects
{ "module": "nodenext", "moduleResolution": "nodenext" }
```

Using the wrong setting causes import resolution errors.

## 6. `isolatedModules` Required for Babel/esbuild

When using transpilers that handle files individually:

```json
{ "isolatedModules": true }
```

This requires `export type` for type-only imports:

```typescript
// ❌ Fails with isolatedModules
import { User } from './types'
export { User }

// ✅ Must use type imports
import type { User } from './types'
export type { User }
// or
import { type User } from './types'
```

## 7. Enum Pitfalls

```typescript
// Numeric enums are not type-safe
enum Status { Active, Inactive }
const s: Status = 999  // No error! (bug)

// ✅ Use string enums or const enums
enum Status { Active = 'ACTIVE', Inactive = 'INACTIVE' }

// ✅ Or use union types (simplest)
type Status = 'active' | 'inactive'
```

## 8. Type Widening with `const`

```typescript
// Inferred as string, not 'hello'
let greeting = 'hello'  // type: string

// Inferred as literal 'hello'
const greeting = 'hello'  // type: 'hello'

// Use 'as const' for objects/arrays
const config = { env: 'production', port: 3000 } as const
// type: { readonly env: 'production', readonly port: 3000 }
```

## 9. Excess Property Checking Only at Assignment

```typescript
interface Point { x: number; y: number }

// ❌ Error: 'z' is not in Point
const p: Point = { x: 1, y: 2, z: 3 }

// ✅ No error when assigned via intermediate variable (structural typing)
const obj = { x: 1, y: 2, z: 3 }
const p: Point = obj  // OK! (structural compatibility)
```

## 10. `ReturnType` and `Awaited` for Inference

```typescript
// Extract return type from function
type FetchResult = ReturnType<typeof fetch>         // Promise<Response>
type ResolvedFetch = Awaited<ReturnType<typeof fetch>>  // Response

// Extract component props type
type ButtonProps = React.ComponentProps<typeof Button>
```

## 11. `tsconfig.json` `paths` Don't Work at Runtime

`paths` in tsconfig.json is **TypeScript-only** — it doesn't affect the actual module resolution at runtime. You must also configure your bundler:

- Next.js: configure in `next.config.js`
- Vite: configure in `vite.config.ts` with `resolve.alias`
- Node.js: use `module-alias` or `tsconfig-paths`
