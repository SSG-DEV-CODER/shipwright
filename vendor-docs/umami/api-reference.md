# Umami — API Reference

<!-- Source: https://umami.is/docs (Context7: /websites/umami_is) -->

## Tracker Functions (Browser)

The `umami` object is globally available after loading the script.

### Track Pageview

```javascript
// Track current page automatically (auto-track is on by default)
umami.track()

// Track with custom data
umami.track({ website: 'WEBSITE_ID', url: '/home', title: 'Home page' })

// Using function to extend default properties
umami.track(props => ({ ...props, url: '/home', title: 'Home page' }))
```

### Track Events

```javascript
// Simple event by name
umami.track('signup-button')

// Event with data
umami.track('signup-button', { plan: 'pro', source: 'header' })

// Using function form (includes default props)
umami.track(props => ({
  ...props,
  name: 'signup-button',
  data: { plan: 'pro' },
}))
```

### Track via HTML Data Attributes

```html
<!-- Event triggered on click -->
<button
  data-umami-event="signup-button"
  data-umami-event-plan="pro"
  data-umami-event-source="header"
>
  Sign Up
</button>
```

### Identify Sessions

```javascript
// Identify with unique ID
umami.identify('user-123')

// With additional data
umami.identify('user-123', { name: 'Alice', plan: 'pro' })

// Without unique ID (just save session data)
umami.identify({ name: 'Alice' })
```

### Track Revenue

```javascript
umami.track('checkout', { revenue: 29.99, currency: 'USD' })
```

HTML attribute form:

```html
<button
  data-umami-event="checkout"
  data-umami-event-revenue="29.99"
  data-umami-event-currency="USD"
>
  Buy Now
</button>
```

## Script Configuration Attributes

```html
<script
  defer
  src="https://your-umami.com/script.js"
  data-website-id="YOUR_WEBSITE_ID"

  data-auto-track="false"        <!-- Disable auto-tracking (manual only) -->
  data-do-not-track="true"       <!-- Respect DNT header -->
  data-cache="true"              <!-- Cache tracking data -->
  data-domains="mysite.com"      <!-- Only track on these domains -->
  data-tag="homepage-variant-a"  <!-- Tag for A/B testing -->
></script>
```

## Exclude Your Own Visits

```javascript
// In browser console — persists across sessions
localStorage.setItem('umami.disabled', 1)

// To re-enable:
localStorage.removeItem('umami.disabled')
```

## REST API

Authentication for self-hosted:

```bash
# Login
curl -X POST https://your-umami.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "umami"}'
# Returns { "token": "eyJ..." }
```

### Website Stats

```http
GET /api/websites/:websiteId/stats?startAt=TIMESTAMP&endAt=TIMESTAMP
```

### Pageviews Over Time

```http
GET /api/websites/:websiteId/pageviews
  ?startAt=1678886400000
  &endAt=1678972800000
  &unit=day
  &timezone=UTC
```

Response:

```json
{
  "pageviews": [
    { "x": "2025-10-19T07:00:00Z", "y": 4129 }
  ],
  "sessions": [
    { "x": "2025-10-19T07:00:00Z", "y": 1397 }
  ]
}
```

## Reports API

### Goal Tracking

```json
POST /api/reports/goals
{
  "websiteId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "type": "goal",
  "filters": {},
  "parameters": {
    "startDate": "2025-07-23T07:00:00.000Z",
    "endDate": "2025-10-22T06:59:59.999Z",
    "type": "event",
    "value": "signup-button"
  }
}
```

Response: `{ "num": 11935, "total": 50602 }`

### Retention Report

```json
POST /api/reports/retention
{
  "websiteId": "your-website-id",
  "type": "retention",
  "parameters": {
    "startDate": "2025-10-01T07:00:00.000Z",
    "endDate": "2025-11-01T06:59:59.999Z",
    "timezone": "America/Los_Angeles"
  }
}
```

### UTM Tracking Report

```json
POST /api/reports/utm
{
  "websiteId": "your-website-id",
  "type": "utm",
  "parameters": {
    "startDate": "2025-10-14T07:00:00.000Z",
    "endDate": "2025-10-22T06:59:59.999Z"
  }
}
```

## Event Data Limits

- Numbers: max 4 decimal places
- Strings: max 500 characters
- Arrays: converted to string, max 500 chars
- Objects: max 50 properties (arrays count as 1)
