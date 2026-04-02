# shadcn/ui — Setup & Installation

<!-- Source: https://github.com/shadcn-ui/ui (Context7: /shadcn-ui/ui) -->

## Quick Start

Initialize shadcn/ui in an existing project:

```bash
npx shadcn@latest init
```

You'll be prompted for:
- Style (default or new-york)
- Base color
- CSS file path
- CSS variables (recommended: yes)

## Initialize with a Specific Framework

```bash
# Next.js
npx shadcn@latest init -t next

# Vite
npx shadcn@latest init -t vite

# Remix
npx create-remix@latest my-app
npx shadcn@latest init

# TanStack Start
npx shadcn@latest init -t start

# Laravel
npx shadcn@latest init --force
```

## Monorepo Setup

```bash
npx shadcn@latest init --monorepo
# Creates web and ui workspaces
```

## Add Components

```bash
# Add a single component
npx shadcn@latest add button

# Add multiple components
npx shadcn@latest add button card dialog

# Add all components
npx shadcn@latest add --all

# Add from custom registry
npx shadcn@latest add @magicui/shimmer-button
npx shadcn@latest add https://example.com/registry/navbar.json
```

## Generated components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

## cn() Utility Function

Generated at `lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Install dependencies:

```bash
npm install clsx tailwind-merge
```

## CSS Variables (Required)

In your globals.css:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    /* ... dark mode vars */
  }
}
```

## Available Components

Run `npx shadcn@latest add` to see all, or visit https://ui.shadcn.com/docs/components

Key components:
- `accordion`, `alert`, `alert-dialog`, `avatar`
- `badge`, `breadcrumb`, `button`
- `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`
- `dialog`, `drawer`, `dropdown-menu`
- `form`, `input`, `label`
- `navigation-menu`
- `pagination`, `popover`, `progress`
- `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `switch`
- `table`, `tabs`, `textarea`, `toast/sonner`, `toggle`, `tooltip`
