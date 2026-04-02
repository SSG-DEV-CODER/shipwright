# OpenAI Node.js SDK — Setup & Installation

<!-- Source: https://github.com/openai/openai-node (Context7: /openai/openai-node) -->

## Installation

```bash
npm install openai
# or
pnpm add openai
# or
yarn add openai
# or
bun add openai
```

For Deno:

```bash
deno add jsr:@openai/openai
```

## Initialize the Client

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Default: reads OPENAI_API_KEY env var
})
```

## Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...
```

## Basic Text Generation

### Responses API (New — Recommended)

```typescript
import OpenAI from 'openai'

const client = new OpenAI()

const response = await client.responses.create({
  model: 'gpt-4o',
  instructions: 'You are a helpful assistant.',
  input: 'What is the capital of France?',
})

console.log(response.output_text)
```

### Chat Completions API (Previous Standard)

```typescript
const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'developer', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' },
  ],
})

console.log(completion.choices[0].message.content)
```

## Client Configuration Options

```typescript
const client = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'https://api.openai.com/v1',  // Custom base URL
  timeout: 60_000,                        // 60 seconds (default: 10 min)
  maxRetries: 2,                          // Auto-retry on transient errors (default: 2)
  defaultHeaders: {
    'X-Custom-Header': 'value',
  },
})

// Per-request overrides
await client.chat.completions.create(
  { model: 'gpt-4o', messages: [...] },
  { timeout: 5000, maxRetries: 0 }
)
```

## Azure OpenAI

```typescript
import { AzureOpenAI } from 'openai'
import { getBearerTokenProvider, DefaultAzureCredential } from '@azure/identity'

const credential = new DefaultAzureCredential()
const scope = 'https://cognitiveservices.azure.com/.default'
const azureADTokenProvider = getBearerTokenProvider(credential, scope)

const openai = new AzureOpenAI({
  azureADTokenProvider,
  apiVersion: '2024-10-01-preview',
})

const result = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
})
```

## Proxy Configuration

```typescript
import OpenAI from 'openai'
import * as undici from 'undici'

const proxyAgent = new undici.ProxyAgent('http://localhost:8888')

const client = new OpenAI({
  fetchOptions: {
    dispatcher: proxyAgent,
  },
})
```
