# Umami — Gotchas & Common Mistakes

<!-- Source: https://umami.is/docs (Context7: /websites/umami_is) -->

## 1. Script Must Load Before Tracking Functions Are Called

```html
<!-- ❌ Calling umami.track() before script loads -->
<script>
  umami.track('page-view')  // umami not defined yet!
</script>
<script defer src="/script.js" data-website-id="..."></script>

<!-- ✅ Script must load first, or use event listeners -->
<script defer src="/script.js" data-website-id="..."></script>
<script>
  // Wait for umami to be available
  document.addEventListener('DOMContentLoaded', () => {
    // umami should be available now if defer loaded
  })
</script>
```

## 2. Auto-Track Sends All Pageviews — Disable for SPAs With Custom Routing

```html
<!-- Disable auto-tracking for manual control in SPAs -->
<script
  defer
  src="/script.js"
  data-website-id="..."
  data-auto-track="false"
></script>
```

Then manually track page views on route changes:

```typescript
// Next.js: in app/layout.tsx or using usePathname
import { usePathname } from 'next/navigation'

function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track()
    }
  }, [pathname])

  return null
}
```

## 3. Event Data Strings Are Limited to 500 Characters

```typescript
// ❌ Long string data gets truncated
umami.track('page-view', { fullContent: longString })

// ✅ Keep data concise
umami.track('page-view', { category: 'blog', slug: 'my-post' })
```

## 4. `data-umami-event` Conflicts With Other Click Handlers

When using HTML data attributes for tracking, Umami intercepts the click. Other event listeners on the same element may not fire:

```html
<!-- ❌ May conflict with onClick handler -->
<button
  data-umami-event="click-handler"
  onclick="doSomething()"
>
  Click me
</button>

<!-- ✅ Use JavaScript tracking instead -->
<button onclick="doSomething(); umami.track('my-event')">
  Click me
</button>
```

## 5. `APP_SECRET` Must Be Rotated Carefully

Changing `APP_SECRET` invalidates all existing login sessions and JWT tokens. Coordinate with team before rotating.

```bash
# .env
APP_SECRET=new-random-string
# All users will be logged out of the Umami admin panel
```

## 6. Self-Hosted Requires PostgreSQL or MySQL — Not SQLite

Umami does NOT support SQLite for production. Use PostgreSQL or MySQL:

```bash
# ✅ PostgreSQL (recommended)
DATABASE_URL=postgresql://user:password@localhost:5432/umami

# ✅ MySQL
DATABASE_URL=mysql://user:password@localhost:3306/umami
```

## 7. Ad Blockers Block the Default `/script.js` Path

Many ad blockers block requests to `/script.js` or domains known as analytics providers. Solutions:

1. **Proxy through your own domain** (recommended):

```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/stats/script.js',
        destination: 'https://your-umami.com/script.js',
      },
      {
        source: '/stats/:path*',
        destination: 'https://your-umami.com/:path*',
      },
    ]
  },
}
```

Then use:

```html
<script defer src="/stats/script.js" data-website-id="..."></script>
```

## 8. The Node.js Client Sends Server-to-Server — No Ad Block Issues

```typescript
import umami from '@umami/node'
// Server-side tracking bypasses ad blockers completely
```

## 9. Distinct IDs Are Limited to 50 Characters

```typescript
// ❌ Long IDs are rejected
umami.identify('very-long-uuid-1234567890-abcdefghijklmnopqrstuvwxyz')

// ✅ Keep IDs under 50 chars
umami.identify('user-123')
umami.identify(userId.substring(0, 50))
```

## 10. Database Migrations Run on First Start

If you update Umami, run migrations before starting:

```bash
pnpm install
pnpm update-db   # Run migrations
pnpm build
pnpm start
```

Skipping this can cause database schema errors.
