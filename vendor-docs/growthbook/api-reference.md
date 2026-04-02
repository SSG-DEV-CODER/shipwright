# GrowthBook — API Reference

<!-- Source: https://docs.growthbook.io (Context7: /websites/growthbook_io) -->

## GrowthBook SDK API

### Initialization

```typescript
import { GrowthBook } from '@growthbook/growthbook'

const gb = new GrowthBook({
  // Required
  apiHost: 'https://cdn.growthbook.io',
  clientKey: 'sdk-abc123',

  // Optional
  attributes: {           // User attributes for targeting
    id: 'user-123',
    country: 'US',
    plan: 'pro',
    isEmployee: false,
  },

  enableDevMode: true,    // Enable DevTools in browser

  trackingCallback: (experiment, result) => {
    // Called when a user is included in an A/B test
    analytics.track('Experiment Viewed', {
      experiment_id: experiment.key,
      variation_id: result.key,
      variation_value: result.value,
    })
  },

  onFeatureUsage: (key, result) => {
    // Called when a feature flag is evaluated
    console.log(`Feature ${key} evaluated:`, result)
  },
})

// Initialize (loads features from API)
await gb.init({ timeout: 2000 })  // Timeout in ms

// Or sync with pre-loaded payload
gb.initSync({ payload: cachedPayload })
```

### Feature Flags

```typescript
// Boolean flag
const isEnabled = gb.isOn('feature-key')
const isDisabled = gb.isOff('feature-key')

// Typed feature values
const color = gb.getFeatureValue('button-color', 'blue')         // string
const maxItems = gb.getFeatureValue('max-items', 10)              // number
const config = gb.getFeatureValue('app-config', { timeout: 5 })  // object

// Full result (includes metadata)
const result = gb.evalFeature('feature-key')
console.log(result.on)             // boolean
console.log(result.off)            // boolean
console.log(result.value)          // the value
console.log(result.source)         // 'defaultValue' | 'force' | 'experiment'
console.log(result.experiment)     // experiment config (if from A/B test)
console.log(result.experimentResult) // user's variation info
```

### User Attributes

```typescript
// Set attributes
gb.setAttributes({
  id: 'user-123',
  country: 'US',
  plan: 'pro',
  email: 'user@example.com',
  loggedIn: true,
})

// Get current attributes
const attrs = gb.getAttributes()

// Update (merge) attributes
gb.setAttributes({ ...gb.getAttributes(), plan: 'enterprise' })
```

### A/B Testing

```typescript
// Run an experiment directly
const result = gb.run({
  key: 'my-experiment',
  variations: [false, true],
  weights: [0.5, 0.5],
  hashAttribute: 'id',
})

if (result.value) {
  showNewFeature()
}
```

### React Hooks

```typescript
import {
  useFeatureIsOn,
  useFeatureValue,
  useGrowthBook,
  IfFeatureEnabled,
  FeatureString,
} from '@growthbook/growthbook-react'

// Boolean flag hook
const showBanner = useFeatureIsOn('show-banner')

// Value hook with fallback
const buttonColor = useFeatureValue('button-color', 'blue')

// Access the GrowthBook instance
const gb = useGrowthBook()
gb.setAttributes({ plan: 'pro' })

// Declarative components
<IfFeatureEnabled feature="new-checkout">
  <NewCheckout />
</IfFeatureEnabled>

<FeatureString feature="hero-headline" default="Welcome!" />
```

## REST API

Base URL: `https://api.growthbook.io/api/v1`

Authentication: `Authorization: Bearer secret_...`

### List Feature Flags

```bash
GET /api/v1/features?limit=20&offset=0
```

### Get Feature Flag

```bash
GET /api/v1/features/my-feature-key
```

### Create Feature Flag

```bash
POST /api/v1/features
{
  "id": "new-dashboard",
  "description": "Enables the new dashboard UI",
  "defaultValue": false,
  "valueType": "boolean"
}
```

### Toggle Feature Flag

```bash
POST /api/v1/features/new-dashboard/toggle
{
  "environments": ["production"],
  "reason": "Ready for launch"
}
```

## SDK Payload Format

The payload loaded from the CDN or API:

```json
{
  "features": {
    "dark-mode": {
      "defaultValue": false,
      "rules": [
        {
          "type": "force",
          "value": true,
          "condition": { "plan": { "$eq": "pro" } }
        },
        {
          "type": "rollout",
          "value": true,
          "coverage": 0.5,
          "hashAttribute": "id"
        },
        {
          "type": "experiment",
          "trackingKey": "dark-mode-test",
          "variations": [false, true],
          "weights": [0.5, 0.5]
        }
      ]
    }
  }
}
```
