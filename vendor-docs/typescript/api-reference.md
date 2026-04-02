# TypeScript — Language API Reference

<!-- Source: https://github.com/microsoft/typescript-website (Context7: /microsoft/typescript-website) -->

## Basic Types

```typescript
// Primitives
let name: string = "Alice"
let age: number = 30
let active: boolean = true
let nothing: null = null
let undef: undefined = undefined
let sym: symbol = Symbol("id")
let big: bigint = 100n

// Arrays
let nums: number[] = [1, 2, 3]
let strs: Array<string> = ["a", "b"]

// Tuple
let pair: [string, number] = ["hello", 42]

// Any (avoid when possible)
let anything: any = "could be anything"

// Unknown (safer than any)
let userInput: unknown = getData()
if (typeof userInput === "string") {
  console.log(userInput.toUpperCase()) // narrowed to string
}

// Never (unreachable code)
function throwError(msg: string): never {
  throw new Error(msg)
}

// Void (function returns nothing)
function logMessage(msg: string): void {
  console.log(msg)
}
```

## Interfaces

```typescript
interface User {
  id: number
  name: string
  email: string
  avatar?: string          // Optional
  readonly createdAt: Date // Read-only
}

// Extending
interface AdminUser extends User {
  role: 'admin'
  permissions: string[]
}
```

## Type Aliases

```typescript
type Status = 'active' | 'inactive' | 'pending'
type ID = string | number
type Point = { x: number; y: number }

// Function type
type Callback = (error: Error | null, result?: string) => void

// Generic type
type Result<T> = {
  data: T | null
  error: Error | null
}
```

## Generics

```typescript
// Generic function
function identity<T>(value: T): T {
  return value
}

// Generic interface
interface Repository<T> {
  findById(id: string): Promise<T | null>
  findAll(): Promise<T[]>
  create(data: Omit<T, 'id'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}

// Generic constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}
```

## Utility Types

```typescript
interface Post {
  id: string
  title: string
  content: string
  status: 'draft' | 'published'
  authorId: string
}

// Partial: all properties optional
type PostDraft = Partial<Post>

// Required: all properties required
type PostRequired = Required<Post>

// Readonly: all properties read-only
type PostReadonly = Readonly<Post>

// Pick: select specific properties
type PostSummary = Pick<Post, 'id' | 'title' | 'status'>

// Omit: exclude specific properties
type CreatePost = Omit<Post, 'id'>

// Record: map type
type StatusCounts = Record<Post['status'], number>

// Exclude: remove from union
type PublishedStatus = Exclude<Post['status'], 'draft'>

// Extract: keep only matching union members
type DraftStatus = Extract<Post['status'], 'draft'>

// NonNullable: remove null/undefined
type NonNull = NonNullable<string | null | undefined> // string

// ReturnType: extract function return type
type FetchResult = ReturnType<typeof fetch>

// Parameters: extract function params as tuple
type FetchParams = Parameters<typeof fetch>

// Awaited: unwrap Promise
type ResolvedData = Awaited<Promise<User>> // User
```

## Type Narrowing

```typescript
// typeof
function process(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase()
  }
  return value.toFixed(2)
}

// instanceof
function format(date: Date | string) {
  if (date instanceof Date) {
    return date.toISOString()
  }
  return date
}

// in operator
interface Cat { meow(): void }
interface Dog { bark(): void }

function makeSound(animal: Cat | Dog) {
  if ('meow' in animal) {
    animal.meow()
  } else {
    animal.bark()
  }
}

// Type predicates
function isString(value: unknown): value is string {
  return typeof value === "string"
}

// Discriminated unions
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2
    case 'square': return shape.side ** 2
  }
}
```

## Enums

```typescript
// String enum (preferred)
enum Direction {
  Up = 'UP',
  Down = 'DOWN',
  Left = 'LEFT',
  Right = 'RIGHT',
}

// Const enum (compiled away)
const enum Color {
  Red,
  Green,
  Blue,
}
```

## Decorators (experimental)

```typescript
// Enable with: "experimentalDecorators": true
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${key} with`, args)
    return original.apply(this, args)
  }
  return descriptor
}

class Service {
  @log
  greet(name: string) {
    return `Hello, ${name}!`
  }
}
```

## Module Augmentation

```typescript
// Extend existing types
declare module 'next/server' {
  interface NextRequest {
    userId?: string
  }
}
```
