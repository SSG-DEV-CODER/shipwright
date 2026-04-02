# then/promise — Gotchas & Known Issues

<!-- Source: https://github.com/then/promise | https://github.com/then/promise/issues -->

## 1. `denodeify` / `nodeify` Not Available in Browser Builds

The browser/UMD build of `promise` intentionally removes Node.js-specific extensions. If you are bundling for the browser via Browserify or Webpack, `Promise.denodeify` and `Promise.nodeify` will be `undefined`.

**Fix:** Only use these methods in Node.js server-side code. If you need them in an isomorphic codebase, guard with:

```js
if (typeof Promise.denodeify === 'function') {
  var readFile = Promise.denodeify(fs.readFile);
}
```

---

## 2. `.done()` Throws Uncaught Exceptions — By Design

Unlike `.then()`, the `.done()` method does **not** return a Promise and does **not** catch errors silently. Any error thrown inside `.done()` propagates as an uncaught exception and will crash Node.js.

```js
// DANGEROUS if processResult throws — crashes the process
doSomething().done(processResult);

// SAFER — use .then().catch() chains instead
doSomething().then(processResult).catch(handleError);
```

Use `.done()` only as the intentional terminal point of a chain when you want errors to be loud.

---

## 3. Differences from Native `Promise` (ES6)

`then/promise` v8.x is a superset of ES6 Promises, but there are subtle differences:

| Feature | then/promise | Native Promise |
|---------|-------------|----------------|
| `Promise.allSettled` | ✅ included | ✅ ES2020+ |
| `Promise.denodeify` | ✅ Node.js build only | ❌ not included |
| `Promise.nodeify` | ✅ Node.js build only | ❌ not included |
| `Promise.done` | ✅ included | ❌ not included |
| `Promise.from` | ⚠️ deprecated alias | ❌ not included |
| Unhandled rejection warnings | May differ | ✅ built-in |

If you are relying on unhandled rejection detection, the native Promise implementation in Node.js 15+ is stricter and more reliable.

---

## 4. Foreign Thenables and `Promise.resolve()`

`Promise.resolve(value)` will assimilate any "thenable" (object with a `.then()` method), such as jQuery Deferred objects. However, the behavior can be surprising if the foreign thenable does not follow the Promises/A+ spec.

```js
// jQuery Deferred — will be assimilated but may behave unexpectedly
var jqDeferred = $.ajax('/api');
Promise.resolve(jqDeferred).then(function(result) {
  // might work, might not — jQuery Deferreds are not fully spec-compliant
});
```

**Fix:** Prefer wrapping foreign async sources manually:

```js
var p = new Promise(function(resolve, reject) {
  $.ajax('/api').done(resolve).fail(reject);
});
```

---

## 5. `denodeify` With Multi-Argument Callbacks

By default, `Promise.denodeify(fn)` resolves with only the **first** result argument from a Node.js callback (ignoring any additional result arguments). Some Node.js APIs like `dns.lookup` return multiple values.

```js
// dns.lookup calls back with (err, address, family)
// Only 'address' is resolved — 'family' is dropped
var lookup = Promise.denodeify(require('dns').lookup);
lookup('google.com').then(function(address) {
  console.log(address); // only the address, not the family
});
```

**Fix:** Use the `length` parameter to control argument passing, or wrap the function manually using `new Promise(...)`.

---

## 6. Using `require('promise')` May Shadow Native Promise

In some bundler configurations, importing `promise` may shadow or override the global `Promise`. Be explicit about which Promise you are using:

```js
// Explicitly use native Promise
const NativePromise = global.Promise;

// Or explicitly use then/promise
const ThenPromise = require('promise');
```

---

## 7. Package Is in Maintenance Mode

As of 2020+, `then/promise` is in maintenance mode. The maintainers consider the library feature-complete. New projects should prefer native `Promise` (available in all modern browsers and Node.js 8+). Use `then/promise` primarily when:

- You need `denodeify`/`nodeify` utilities (though standalone packages like `pify` are available alternatives)
- You need `allSettled` in older environments (though a polyfill is now standard)
- You are working with a codebase that already depends on it

---

## 8. Version 8.x vs 7.x Breaking Changes

Version 8.x introduced changes to how synchronous resolution is handled (following the spec more strictly). If upgrading from v7.x:

- Some code relying on synchronous promise resolution order may behave differently
- The `Promise.from` alias was deprecated (use `Promise.resolve`)
- Browser-specific entry points changed

Always run your test suite after upgrading.
