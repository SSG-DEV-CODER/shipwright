# Tailwind CSS — Gotchas & Common Mistakes

<!-- Source: https://github.com/tailwindlabs/tailwindcss.com (Context7: /tailwindlabs/tailwindcss.com) -->

## 1. v4 vs v3: Major Breaking Changes

Tailwind v4 is a complete rewrite. Key changes:

- No more `tailwind.config.js` (use `@theme` in CSS)
- Import is `@import "tailwindcss"` instead of `@tailwind base; @tailwind components; @tailwind utilities;`
- PostCSS plugin is `@tailwindcss/postcss` not `tailwindcss`
- Vite plugin: `@tailwindcss/vite`
- Many class names changed (e.g., `shadow-sm` → different values)

## 2. Dynamic Class Names Are Purged

**Problem:** Dynamically constructed class names are not detected by Tailwind's scanner.

```typescript
// ❌ Tailwind can't detect this — class will be purged
const size = 'lg'
const classes = `text-${size}` // text-lg won't be in output

// ✅ Use complete class names
const classes = size === 'lg' ? 'text-lg' : 'text-sm'

// ✅ Or use a mapping object
const sizeMap = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}
const classes = sizeMap[size]
```

## 3. Arbitrary Values Syntax

```html
<!-- Use brackets for one-off values -->
<div class="w-[347px] bg-[#1da1f2] text-[14px]">

<!-- With CSS variables -->
<div class="bg-[var(--brand-color)]">

<!-- Calc expressions -->
<div class="w-[calc(100%-2rem)]">
```

## 4. `@apply` Only Works in CSS Files (and Only in v3)

```typescript
// ❌ Won't work in JSX/TSX
const className = `@apply flex items-center` // Invalid

// ✅ Use @apply only in .css files (v3 only)
/* globals.css */
.my-component {
  @apply flex items-center gap-2;
}
```

In v4, `@apply` still exists but is less recommended. Use utility classes directly.

## 5. Class Merging with `clsx` + `tailwind-merge`

When classes conflict, last one wins but can cause issues:

```typescript
// Install: pnpm add clsx tailwind-merge
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ✅ Properly merges conflicting Tailwind classes
cn('bg-red-500', 'bg-blue-500')  // → 'bg-blue-500' (correct!)
// Without twMerge: 'bg-red-500 bg-blue-500' (both applied, unpredictable)
```

## 6. Container is Not Centered by Default (v3)

```javascript
// tailwind.config.js v3
module.exports = {
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
  },
}
```

## 7. Peer and Group Modifiers Require HTML Attribute

```html
<!-- group modifier: parent must have 'group' class -->
<div class="group">
  <span class="group-hover:text-blue-500">I change on parent hover</span>
</div>

<!-- peer modifier: sibling must have 'peer' class -->
<input class="peer" type="checkbox" />
<label class="peer-checked:text-blue-500">Checked state</label>
```

## 8. JIT Mode Always On in v3.0+

There's no need to enable JIT mode anymore — it's the default since v3.0. Remove any `mode: 'jit'` config.

## 9. Forms Plugin Required for Styled Inputs

Without `@tailwindcss/forms`, form elements look unstyled and ugly:

```bash
npm install @tailwindcss/forms
```

```javascript
// tailwind.config.js (v3)
plugins: [require('@tailwindcss/forms')]
```

## 10. v4 `@theme` Variables Are Scoped

In v4, theme variables defined in `@theme` are CSS custom properties available globally:

```css
@theme {
  --color-primary: oklch(0.55 0.22 260);
}

/* Use anywhere in CSS */
.my-element {
  background-color: var(--color-primary);
}
```

But utility classes are generated from them: `bg-primary`, `text-primary`, etc.
