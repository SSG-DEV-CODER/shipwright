# Tailwind CSS — Configuration

<!-- Source: https://github.com/tailwindlabs/tailwindcss.com (Context7: /tailwindlabs/tailwindcss.com) -->

## Tailwind v4: CSS-First Configuration

In v4, configuration is done directly in CSS using `@theme`:

```css
@import "tailwindcss";

@theme {
  /* Custom fonts */
  --font-display: "Satoshi", "sans-serif";
  --font-sans: "Inter", sans-serif;

  /* Custom breakpoints */
  --breakpoint-3xl: 1920px;

  /* Custom colors */
  --color-brand-50: oklch(0.98 0.02 260);
  --color-brand-500: oklch(0.55 0.22 260);
  --color-brand-900: oklch(0.25 0.15 260);

  /* Custom spacing */
  --spacing-18: 4.5rem;

  /* Custom easing */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
}
```

## Default Breakpoints

```css
/* Tailwind default breakpoints */
:root {
  --breakpoint-sm: 40rem;   /* 640px */
  --breakpoint-md: 48rem;   /* 768px */
  --breakpoint-lg: 64rem;   /* 1024px */
  --breakpoint-xl: 80rem;   /* 1280px */
  --breakpoint-2xl: 96rem;  /* 1536px */
}
```

## Prefix (Avoid CSS Conflicts)

```css
@import "tailwindcss" prefix(tw);
```

Now classes are: `tw-flex`, `tw-text-red-500`, etc.

## Dark Mode

```css
@import "tailwindcss";

@variant dark (&:where(.dark, .dark *));
```

Or use the media query variant:

```html
<!-- Toggle dark mode by adding 'dark' class to <html> -->
<html class="dark">
```

```html
<!-- Responsive dark mode -->
<div class="bg-white dark:bg-gray-900">
```

## Tailwind v3: tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // or 'media'
  theme: {
    // Override defaults entirely
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      // Extend defaults
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Satoshi', 'sans-serif'],
      },
      spacing: {
        18: '4.5rem',
        112: '28rem',
      },
      animation: {
        wiggle: 'wiggle 1s ease-in-out infinite',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
}
```

## TypeScript Config (v3)

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
```

## @apply Directive (v3)

```css
/* Only available in v3 within @layer */
@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }
  .btn-primary {
    @apply bg-blue-600 text-white hover:bg-blue-700;
  }
}
```

## Responsive Design Pattern

```html
<!-- Mobile-first, add modifiers for larger screens -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- ... -->
</div>
```

## Common Utility Patterns

```html
<!-- Flexbox centering -->
<div class="flex items-center justify-center">

<!-- Grid with gap -->
<div class="grid grid-cols-3 gap-4">

<!-- Text truncation -->
<p class="truncate max-w-xs">Long text...</p>

<!-- Aspect ratio -->
<div class="aspect-video bg-gray-200">

<!-- Focus ring -->
<button class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">

<!-- Transition -->
<div class="transition-all duration-300 ease-in-out hover:scale-105">
```
