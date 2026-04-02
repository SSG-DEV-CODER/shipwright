# GrowthBook — Setup & Getting Started

<!-- Source: https://docs.growthbook.io (Context7: /websites/growthbook_io) -->

## Install the SDK

```bash
# JavaScript/TypeScript
npm install @growthbook/growthbook

# React
npm install @growthbook/growthbook-react
```

## Quick Start: JavaScript

```typescript
import { GrowthBook } from '@growthbook/growthbook'

const gb = new GrowthBook({
  apiHost: 'https://cdn.growthbook.io',
  clientKey: 'sdk-abc123',
  // For experiments: provide tracking callback
  trackingCallback: (experiment, result) => {
    analytics.track('Experiment Viewed', {
      experimentId: experiment.key,
      variationId: result.key,
    })
  },
})

// Wait for features to load
await gb.init({ timeout: 2000 })

// Set user attributes for targeting
gb.setAttributes({
  id: 'user-123',
  country: 'US',
  plan: 'pro',
})

// Use feature flags
if (gb.isOn('new-dashboard')) {
  showNewDashboard()
}

const buttonColor = gb.getFeatureValue('button-color', 'blue')
```

## React Integration

```typescript
// app/providers.tsx
'use client'
import { GrowthBook, GrowthBookProvider } from '@growthbook/growthbook-react'
import { useEffect } from 'react'

const gb = new GrowthBook({
  apiHost: 'https://cdn.growthbook.io',
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY!,
  enableDevMode: process.env.NODE_ENV !== 'production',
})

export function GrowthBookWrapper({ children, attributes }) {
  useEffect(() => {
    gb.init()
  }, [])

  useEffect(() => {
    gb.setAttributes(attributes)
  }, [attributes])

  return (
    <GrowthBookProvider growthbook={gb}>
      {children}
    </GrowthBookProvider>
  )
}
```

```typescript
// In a component
import { useFeatureIsOn, useFeatureValue } from '@growthbook/growthbook-react'

function MyComponent() {
  const showBanner = useFeatureIsOn('show-banner')
  const buttonColor = useFeatureValue('button-color', 'blue')

  return (
    <div>
      {showBanner && <Banner />}
      <button style={{ backgroundColor: buttonColor }}>Click me</button>
    </div>
  )
}
```

## Next.js App Router (Server-Side)

Install packages:

```bash
npm install @growthbook/growthbook @vercel/flags @vercel/edge-config
```

Server-side flag evaluation:

```typescript
// lib/flags.ts
import { GrowthBook } from '@growthbook/growthbook'
import { get } from '@vercel/edge-config'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { unstable_flag as flag } from '@vercel/flags/next'

const getGrowthBookInstance = cache(async () => {
  const payload = await get('gb_payload')
  const cookieStore = await cookies()

  return new GrowthBook({
    attributes: {
      id: cookieStore.get('gbuuid')?.value,
    },
  }).initSync({ payload: JSON.parse(payload) })
})

export function getFlagValue<T>(key: string, defaultValue: T) {
  return flag<T>({
    key,
    defaultValue,
    decide: async () => {
      const gb = await getGrowthBookInstance()
      return gb.getFeatureValue(key, defaultValue)
    },
  })()
}
```

Usage in page:

```typescript
// app/page.tsx
import { getFlagValue } from '@/lib/flags'

export default async function Home() {
  const showBanner = await getFlagValue('show-banner', false)
  const headerText = await getFlagValue('header-text', 'Welcome!')

  return (
    <div>
      {showBanner && <Banner />}
      <h1>{headerText}</h1>
    </div>
  )
}
```

## Express.js Middleware

```bash
npm install @growthbook/growthbook express
```

```typescript
import express from 'express'
import { GrowthBookClient } from '@growthbook/growthbook'

const client = new GrowthBookClient({
  apiHost: 'https://cdn.growthbook.io',
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY!,
})
await client.init()

// Middleware: create user-scoped instance per request
app.use((req, res, next) => {
  req.growthbook = client.createScopedInstance({
    attributes: {
      id: req.user?.id || 'anonymous',
      country: req.headers['x-country'],
    },
  })
  next()
})

app.get('/', (req, res) => {
  const greeting = req.growthbook.isOn('spanish-greeting')
    ? 'Hola Mundo!'
    : 'Hello World!'
  res.send(greeting)
})

app.listen(3000)
```

## Environment Variables

```bash
NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY=sdk-abc123
GROWTHBOOK_API_HOST=https://cdn.growthbook.io
# For private API access:
GROWTHBOOK_SECRET_KEY=secret_...
```
