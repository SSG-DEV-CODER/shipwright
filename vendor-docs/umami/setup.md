# Umami — Setup & Installation

<!-- Source: https://umami.is/docs (Context7: /websites/umami_is) -->

## Cloud (Easiest)

Sign up at https://umami.is — managed hosting, no setup required.

## Self-Hosted with Docker

```bash
git clone https://github.com/umami-software/umami.git
cd umami
cp .env.example .env
```

Edit `.env`:

```bash
DATABASE_URL=postgresql://umami:umami@localhost:5432/umami
APP_SECRET=random-string-here-replace-this
```

```bash
docker compose up -d
```

Access at: http://localhost:3000
Default credentials: `admin` / `umami`

## Self-Hosted with PM2

```bash
git clone https://github.com/umami-software/umami.git
cd umami
pnpm install
pnpm update-db
pnpm build

# Start with PM2
npm install -g pm2
pm2 start npm --name umami -- start
pm2 save
```

## Install Tracking Script

Add to your website's `<head>` or `<body>`:

```html
<script
  defer
  src="https://your-umami-instance.com/script.js"
  data-website-id="your-website-id"
></script>
```

## Next.js Integration

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          defer
          src="https://your-umami-instance.com/script.js"
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## Google Tag Manager Workaround

Standard `data-*` attributes get stripped by GTM. Use this instead:

```html
<script>
  (function () {
    var el = document.createElement('script');
    el.setAttribute('src', 'https://your-umami.com/script.js');
    el.setAttribute('data-website-id', 'your-website-id');
    document.body.appendChild(el);
  })();
</script>
```

## Node.js Server-Side Tracking

```bash
npm install @umami/node
```

```typescript
import umami from '@umami/node'

umami.init({
  websiteId: '50429a93-8479-4073-be80-d5d29c09c2ec',
  hostUrl: 'https://your-umami-instance.com',
})

// Track a pageview
await umami.track({ url: '/home' })

// Track an event
await umami.track('button-click', { buttonName: 'signup' })
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/umami
APP_SECRET=your-random-secret

# Optional
PORT=3000
HOSTNAME=0.0.0.0
BASE_PATH=/analytics   # For subpath hosting
DATABASE_TYPE=postgresql  # or mysql
```
