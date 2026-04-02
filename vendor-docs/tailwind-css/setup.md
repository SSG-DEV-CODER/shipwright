# Tailwind CSS — Setup & Installation

<!-- Source: https://github.com/tailwindlabs/tailwindcss.com (Context7: /tailwindlabs/tailwindcss.com) -->

## Tailwind CSS v4 (Current)

### With Vite

```bash
npm install tailwindcss@latest @tailwindcss/vite@latest
```

`vite.config.ts`:

```typescript
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss()],
})
```

### With PostCSS

```bash
npm install tailwindcss @tailwindcss/postcss
```

`postcss.config.js`:

```js
export default {
  plugins: ["@tailwindcss/postcss"],
}
```

### With Next.js (PostCSS)

```bash
pnpm add -D tailwindcss @tailwindcss/postcss
```

`postcss.config.js`:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

## CSS Entry Point

Import Tailwind in your main CSS file:

```css
/* globals.css */
@import "tailwindcss";
```

That's it for v4! No more `tailwind.config.js` needed by default.

## Tailwind CSS v3 (Legacy)

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

`globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## With Next.js v4 Quickstart

```bash
npx create-next-app@latest --tailwind my-app
```

This sets everything up automatically.

## With shadcn/ui (v4)

shadcn/ui initializes Tailwind v4 automatically:

```bash
npx shadcn@latest init
```

## Prettier Plugin (Class Sorting)

```bash
npm install -D prettier prettier-plugin-tailwindcss
```

`.prettierrc`:

```json
{
  "plugins": ["prettier-plugin-tailwindcss"]
}
```
