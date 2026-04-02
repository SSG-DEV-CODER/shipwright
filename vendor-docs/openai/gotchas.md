# OpenAI Node.js SDK — Gotchas & Common Mistakes

<!-- Source: https://github.com/openai/openai-node (Context7: /openai/openai-node) -->

## 1. API Key Must Never Be in Client-Side Code

```typescript
// ❌ NEVER expose in browser/client-side code
const client = new OpenAI({ apiKey: 'sk-...' })

// ✅ Only use server-side (Next.js server components, API routes, etc.)
// Server component or API route:
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Server env var, not NEXT_PUBLIC_
})
```

## 2. Default Timeout is 10 Minutes — Set a Reasonable Limit

```typescript
// ❌ Requests can hang for 10 minutes by default
const client = new OpenAI()

// ✅ Set appropriate timeouts
const client = new OpenAI({
  timeout: 30_000,   // 30 seconds for normal requests
  maxRetries: 2,
})

// Per-request for long operations
const response = await client.chat.completions.create(
  { model: 'gpt-4o', messages: [...], stream: true },
  { timeout: 120_000 }  // 2 minutes for streaming
)
```

## 3. Streaming Responses Are Not Typed Like Regular Responses

```typescript
// Non-streaming: returns ChatCompletion
const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
})
const text = completion.choices[0].message.content  // string | null

// Streaming: returns async iterable of chunks
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  stream: true,
})
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content || ''
  process.stdout.write(delta)  // delta is a partial string
}
```

## 4. Rate Limits — Implement Exponential Backoff

The SDK automatically retries on rate limits (429) with exponential backoff. But you can customize:

```typescript
const client = new OpenAI({
  maxRetries: 3,       // Retry up to 3 times
  // Default retry strategy handles 408, 409, 429, 5xx
})

// Disable retries for specific requests
await client.chat.completions.create(
  { model: 'gpt-4o', messages: [...] },
  { maxRetries: 0 }
)
```

## 5. Token Counting — Context Window Limits

Different models have different context windows:
- `gpt-4o`: 128k tokens
- `gpt-4o-mini`: 128k tokens
- `gpt-3.5-turbo`: 16k tokens

Use `tiktoken` to count tokens before sending:

```typescript
import { encode } from 'gpt-tokenizer'

const tokens = encode(text)
console.log(`Token count: ${tokens.length}`)

if (tokens.length > 100_000) {
  // Truncate or chunk the content
}
```

## 6. `response_format: { type: 'json_object' }` Requires JSON in System Prompt

```typescript
// ❌ Will error or return garbage
await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'List 5 fruits' }],
  response_format: { type: 'json_object' },
})

// ✅ Must mention JSON in system/user message
await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON.' },
    { role: 'user', content: 'List 5 fruits as JSON array' },
  ],
  response_format: { type: 'json_object' },
})
```

## 7. Structured Outputs (`response_format: zodResponseFormat`) Requires Compatible Models

`zodResponseFormat` / structured outputs require:
- `gpt-4o-2024-08-06` or newer
- `gpt-4o-mini-2024-07-18` or newer

```typescript
// ❌ Older models don't support structured outputs
const completion = await client.chat.completions.parse({
  model: 'gpt-4-turbo',  // Too old!
  // ...
})

// ✅ Use a supported model
const completion = await client.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  // ...
})
```

## 8. Image Inputs Require Base64 or URL

```typescript
// ✅ URL (must be publicly accessible)
{ role: 'user', content: [
  { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
  { type: 'text', text: 'What is in this image?' },
]}

// ✅ Base64 encoded
import fs from 'fs'
const imageData = fs.readFileSync('image.jpg').toString('base64')
{ role: 'user', content: [
  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } },
]}
```

## 9. Error Types

```typescript
import OpenAI from 'openai'

try {
  const res = await client.chat.completions.create(...)
} catch (e) {
  if (e instanceof OpenAI.RateLimitError) {
    // 429 — wait and retry
  } else if (e instanceof OpenAI.AuthenticationError) {
    // 401 — bad API key
  } else if (e instanceof OpenAI.BadRequestError) {
    // 400 — invalid request (check your params)
  } else if (e instanceof OpenAI.InternalServerError) {
    // 500 — OpenAI server error, retry
  } else if (e instanceof OpenAI.APIConnectionError) {
    // Network error
  }
}
```

## 10. `httpAgent` Was Removed in SDK v5

```typescript
// ❌ httpAgent no longer works (removed in v5)
const client = new OpenAI({
  httpAgent: new HttpsProxyAgent(proxyUrl),
})

// ✅ Use fetchOptions with undici
import * as undici from 'undici'
const client = new OpenAI({
  fetchOptions: { dispatcher: new undici.ProxyAgent(proxyUrl) },
})
```
