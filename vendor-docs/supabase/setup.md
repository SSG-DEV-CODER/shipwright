# Supabase — Setup & Installation

<!-- Source: https://github.com/supabase/supabase (Context7: /supabase/supabase) -->

## Install the JavaScript Client

```bash
npm install @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
# or
yarn add @supabase/supabase-js
```

## Initialize the Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://<project-ref>.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only
```

## Using in Next.js (App Router with SSR)

Install the SSR package:

```bash
pnpm add @supabase/ssr
```

Create a browser client:

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create a server client:

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

## Local Development with Supabase CLI

```bash
# Install CLI
npm install supabase --save-dev

# Initialize project
supabase init

# Start local stack (requires Docker)
supabase start

# Link to remote project
supabase link --project-ref YOUR_PROJECT_ID

# Push schema changes
supabase db push

# Pull schema from remote
supabase db pull
```

## Docker Compose (Self-Hosted)

```bash
cd docker
cp .env.example .env
docker compose up
```

## Supabase CLI — Common Commands

```bash
supabase start          # Start local Supabase
supabase stop           # Stop local Supabase
supabase status         # Show local endpoints + keys
supabase migration up   # Apply pending migrations
supabase db reset       # Reset database (drops all data)
supabase gen types typescript --local > database.types.ts  # Generate TypeScript types
```
