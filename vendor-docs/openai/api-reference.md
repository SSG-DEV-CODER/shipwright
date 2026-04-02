# OpenAI Node.js SDK — API Reference

<!-- Source: https://github.com/openai/openai-node (Context7: /openai/openai-node) -->

## Chat Completions

```typescript
const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing' },
  ],
  temperature: 0.7,         // 0-2, default 1
  max_tokens: 500,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  stop: ['\n\n'],           // Stop sequences
  n: 1,                     // Number of choices
})

console.log(completion.choices[0].message.content)
console.log(completion.usage?.total_tokens)
```

## Streaming

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
})

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content || ''
  process.stdout.write(delta)
}

// Access request_id for debugging
const { data: stream2, request_id } = await client.chat.completions
  .create({ model: 'gpt-4o', messages: [...], stream: true })
  .withResponse()
```

## Structured Outputs (with Zod)

```typescript
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const AnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  score: z.number().min(0).max(1),
  summary: z.string(),
  keywords: z.array(z.string()),
})

const completion = await client.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages: [
    { role: 'system', content: 'Analyze the sentiment of the text.' },
    { role: 'user', content: 'I love this product!' },
  ],
  response_format: zodResponseFormat(AnalysisSchema, 'analysis'),
})

const analysis = completion.choices[0].message.parsed
// analysis.sentiment === 'positive'
// analysis.score === 0.95
```

## Function/Tool Calling

```typescript
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
        },
        required: ['city'],
      },
    },
  },
]

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: "What's the weather in Tokyo?" }],
  tools,
  tool_choice: 'auto',
})

const message = response.choices[0].message
if (message.tool_calls) {
  const toolCall = message.tool_calls[0]
  const args = JSON.parse(toolCall.function.arguments)
  // Call your actual function: getWeather(args.city, args.unit)
}
```

## Embeddings

```typescript
const embedding = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'The quick brown fox',
})

const vector = embedding.data[0].embedding // float[]
console.log(`Dimensions: ${vector.length}`) // 1536
```

## File Uploads

```typescript
import fs from 'fs'
import { toFile } from 'openai'

// From file system
await client.files.create({
  file: fs.createReadStream('data.jsonl'),
  purpose: 'fine-tune',
})

// From Buffer
await client.files.create({
  file: await toFile(Buffer.from('data'), 'data.jsonl'),
  purpose: 'fine-tune',
})

// List files
const files = await client.files.list()

// Delete file
await client.files.del('file-abc123')
```

## Images (DALL-E)

```typescript
const image = await client.images.generate({
  model: 'dall-e-3',
  prompt: 'A beautiful sunset over mountains',
  n: 1,
  size: '1024x1024',
  quality: 'standard',    // 'standard' or 'hd'
  style: 'vivid',         // 'vivid' or 'natural'
})

console.log(image.data[0].url)
```

## Audio

```typescript
// Text-to-speech
const audio = await client.audio.speech.create({
  model: 'tts-1',
  input: 'Hello, world!',
  voice: 'alloy',  // alloy, echo, fable, onyx, nova, shimmer
})
const buffer = Buffer.from(await audio.arrayBuffer())
fs.writeFileSync('speech.mp3', buffer)

// Speech-to-text (Whisper)
const transcription = await client.audio.transcriptions.create({
  file: fs.createReadStream('audio.mp3'),
  model: 'whisper-1',
  language: 'en',
})
console.log(transcription.text)
```

## Assistants API (Beta)

```typescript
// Create assistant
const assistant = await client.beta.assistants.create({
  name: 'Math Tutor',
  instructions: 'You are a helpful math tutor.',
  model: 'gpt-4o',
  tools: [{ type: 'code_interpreter' }],
})

// Create thread
const thread = await client.beta.threads.create()

// Add message
await client.beta.threads.messages.create(thread.id, {
  role: 'user',
  content: 'Solve: 3x + 11 = 14',
})

// Run with streaming
const run = client.beta.threads.runs
  .stream(thread.id, { assistant_id: assistant.id })
  .on('textDelta', (delta) => process.stdout.write(delta.value ?? ''))
```

## Error Handling

```typescript
import OpenAI from 'openai'

try {
  const response = await client.chat.completions.create({ ... })
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.log('Request ID:', error.request_id)
    console.log('Status:', error.status)
    console.log('Name:', error.name)
    // BadRequestError (400), AuthenticationError (401),
    // PermissionDeniedError (403), NotFoundError (404),
    // RateLimitError (429), InternalServerError (500)
  }
  throw error
}
```

## Models Reference

| Model | Best For |
|-------|----------|
| `gpt-4o` | Most capable, multimodal |
| `gpt-4o-mini` | Faster, cheaper, great for most tasks |
| `gpt-4-turbo` | Previous gen flagship |
| `o1` | Complex reasoning |
| `o3-mini` | Fast reasoning |
| `text-embedding-3-small` | Embeddings (1536 dims) |
| `text-embedding-3-large` | High accuracy embeddings (3072 dims) |
| `dall-e-3` | Image generation |
| `tts-1` | Text to speech |
| `whisper-1` | Speech to text |
