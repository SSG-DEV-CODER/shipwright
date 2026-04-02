# GrowthBook — Gotchas & Common Mistakes

<!-- Source: https://docs.growthbook.io (Context7: /websites/growthbook_io) -->

## 1. SDK Must Be Initialized Before Evaluating Flags

```typescript
// ❌ Flags evaluated before features loaded
const gb = new GrowthBook({ clientKey: 'sdk-abc' })
const flag = gb.isOn('my-feature')  // Always returns false — not loaded yet!

// ✅ Wait for initialization
const gb = new GrowthBook({ clientKey: 'sdk-abc' })
await gb.init({ timeout: 2000 })
const flag = gb.isOn('my-feature')  // Now returns correct value
```

## 2. Attributes Must Be Set Before Evaluating Flags

```typescript
// ❌ No attributes set — targeting rules won't match
const gb = new GrowthBook({ clientKey: 'sdk-abc' })
await gb.init()
const flag = gb.isOn('pro-feature')  // May not work if targeting requires user.plan

// ✅ Set attributes first
const gb = new GrowthBook({
  clientKey: 'sdk-abc',
  attributes: {
    id: user.id,
    plan: user.plan,
    country: 'US',
  },
})
await gb.init()
const flag = gb.isOn('pro-feature')
```

## 3. Client Key vs Secret Key

```typescript
// Client key: safe for browser (SDK_KEY starting with 'sdk-')
// Loads features from CDN — read-only
const gb = new GrowthBook({ clientKey: 'sdk-abc123' })

// Secret key: SERVER-SIDE ONLY (starting with 'secret_')
// Use for REST API calls only — never expose in client code
const response = await fetch('https://api.growthbook.io/api/v1/features', {
  headers: { 'Authorization': `Bearer ${process.env.GROWTHBOOK_SECRET}` }
})
```

## 4. Experiment Tracking Callback Must Be Set

Without `trackingCallback`, A/B test data won't reach your analytics:

```typescript
const gb = new GrowthBook({
  clientKey: 'sdk-abc',
  trackingCallback: (experiment, result) => {
    // Required! Send to analytics
    analytics.track('$experiment_started', {
      experiment_id: experiment.key,
      variation_id: result.key,
    })
  },
})
```

## 5. `getFeatureValue` Fallback Is Returned When Flag Not Found

```typescript
// If 'button-color' feature doesn't exist in GrowthBook,
// the fallback value 'blue' is returned — no error
const color = gb.getFeatureValue('button-color', 'blue')
```

This is intentional for graceful degradation, but can mask typos in feature key names.

## 6. SSR: New GrowthBook Instance Per Request

```typescript
// ❌ Shared instance across requests (wrong attributes for different users)
const gb = new GrowthBook({ clientKey: 'sdk-abc' })

// ✅ New instance per request, or use scoped instances
const client = new GrowthBookClient({ clientKey: 'sdk-abc' })
await client.init()

// Per-request:
const gb = client.createScopedInstance({
  attributes: { id: req.user?.id }
})
```

## 7. Feature Payload Caching

The SDK loads features from the GrowthBook CDN. Cache the payload to avoid repeated fetches:

```typescript
// Cache payload in Redis/memory
const payload = await getFromCache('growthbook_payload')
  ?? await fetchFromGrowthBook()

gb.initSync({ payload })
```

## 8. Development Mode Shows DevTools in Browser

```typescript
// Disable in production!
const gb = new GrowthBook({
  enableDevMode: process.env.NODE_ENV === 'development',
})
```

## 9. Sticky Bucketing Requires User Identifiers

For consistent A/B test assignment across sessions:

```typescript
const gb = new GrowthBook({
  attributes: {
    id: user.id,           // Stable user ID for assignment
    deviceId: deviceId,    // Fallback for logged-out users
  },
  // hashAttribute is 'id' by default
})
```

Without a stable ID, the same user can be assigned to different variations on different sessions.

## 10. Rule Priorities Matter

In GrowthBook's feature rules:
1. Force rules (override for specific users)
2. Rollout rules (percentage of users)
3. Experiment rules (A/B test)
4. Default value

Higher rules override lower ones. If a force rule matches, the experiment won't run.
