# shadcn/ui — Gotchas & Common Mistakes

<!-- Source: https://github.com/shadcn-ui/ui (Context7: /shadcn-ui/ui) -->

## 1. Components Are Copied Into Your Codebase, Not Installed as a Dependency

shadcn/ui is NOT a traditional npm package. `npx shadcn add button` copies the component source into your project's `components/ui/` directory. You own and edit these files.

```bash
# This copies source code, NOT installs a package
npx shadcn@latest add button

# Your file: components/ui/button.tsx (you own it, edit it freely)
```

## 2. `cn()` Utility Is Required

Most components depend on the `cn()` helper from `lib/utils.ts`. Make sure it exists:

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

```bash
# Required deps
npm install clsx tailwind-merge
```

## 3. CSS Variables Must Be in globals.css

Components use CSS variables like `--background`, `--primary`, etc. These must be defined:

```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    /* ... all variables */
  }
  .dark {
    --background: 222.2 84% 4.9%;
    /* ... dark mode variables */
  }
}
```

Running `npx shadcn@latest init` sets these up automatically.

## 4. Tailwind Config Must Include Component Paths

```javascript
// tailwind.config.js (v3)
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',  // ← Include components directory
    './src/**/*.{ts,tsx}',
  ],
}
```

## 5. v4 vs v3: Different tailwind.config Approach

With Tailwind v4, shadcn uses CSS variables natively:

```css
/* globals.css with v4 */
@import "tailwindcss";

@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    /* ... */
  }
}
```

Check which Tailwind version your project uses before following tutorials.

## 6. `asChild` Pattern for Polymorphic Components

Many shadcn components support `asChild` to render as a different element:

```tsx
import { Button } from "@/components/ui/button"
import Link from "next/link"

// ❌ Nested anchor inside button (invalid HTML)
<Button><Link href="/about">About</Link></Button>

// ✅ Use asChild to render Button as Link
<Button asChild>
  <Link href="/about">About</Link>
</Button>
// Renders: <a href="/about" class="...button styles...">About</a>
```

## 7. Form Component Requires `react-hook-form` and `zod`

The `Form` component wraps react-hook-form — it's not standalone:

```bash
npm install react-hook-form @hookform/resolvers zod
npx shadcn@latest add form
```

## 8. Dark Mode Class Must Be on `<html>` Element

```typescript
// With next-themes:
npm install next-themes

// app/layout.tsx
import { ThemeProvider } from "next-themes"

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

## 9. Dialog/Sheet/Drawer Are Uncontrolled by Default

They manage their own open state. To control externally:

```tsx
// ❌ Trying to control state without open/onOpenChange
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>

// ✅ Controlled dialog
const [open, setOpen] = useState(false)
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button onClick={() => setOpen(true)}>Open</Button>
  </DialogTrigger>
  <DialogContent onInteractOutside={() => setOpen(false)}>
    ...
  </DialogContent>
</Dialog>
```

## 10. Radix UI Primitives Are Peer Dependencies

Components are built on Radix UI. If you get peer dep errors:

```bash
# Install radix ui (monorepo package)
npm install radix-ui

# Or install specific primitives
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

## 11. Updating Components After `shadcn` Releases New Versions

```bash
# Preview what would change
npx shadcn diff button

# Update with diff preview
npx shadcn add button  # Prompts to overwrite
```

Since you own the components, `shadcn` cannot auto-update them — you must re-add and manually merge your customizations.
