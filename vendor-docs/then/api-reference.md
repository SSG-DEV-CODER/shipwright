# then/promise — API Reference

<!-- Source: https://github.com/then/promise | https://www.promisejs.org/api/ -->

## Constructor

### `new Promise(resolver)`

Creates and returns a new promise. The `resolver` must be a function.

```js
var p = new Promise(function(resolve, reject) {
  // resolve(value)  — fulfill the promise with a value
  // reject(reason)  — reject the promise with a reason
});
```

**Resolver arguments:**

| Argument  | Behavior |
|-----------|----------|
| `resolve(value)` | If `value` is a non-promise, fulfills with that value. If `value` is a promise, the returned promise takes on that promise's state. |
| `reject(reason)` | Rejects the promise with `reason`. |

---

## Static Methods

### `Promise.resolve(value)`

Returns a promise fulfilled with `value`. If `value` is already a promise, returns it as-is.

```js
Promise.resolve(42).then(function(val) {
  console.log(val); // 42
});
```

---

### `Promise.reject(reason)`

Returns a promise rejected with `reason`.

```js
Promise.reject(new Error('oops')).catch(function(err) {
  console.error(err.message); // "oops"
});
```

---

### `Promise.all(array)`

Takes an array of promises (or values). Returns a promise that:
- **Fulfills** with an array of results when all input promises fulfill.
- **Rejects** as soon as any input promise rejects.

```js
Promise.all([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3)
]).then(function(results) {
  console.log(results); // [1, 2, 3]
});
```

---

### `Promise.allSettled(array)`

Takes an array of promises. Returns a promise that always fulfills (never rejects) with an array of outcome objects.

Each outcome object has the shape:
- `{ status: 'fulfilled', value: <value> }`
- `{ status: 'rejected', reason: <error> }`

```js
Promise.allSettled([
  Promise.resolve('ok'),
  Promise.reject(new Error('fail')),
  Promise.resolve('also ok')
]).then(function(results) {
  results.forEach(function(r) {
    if (r.status === 'fulfilled') {
      console.log('fulfilled:', r.value);
    } else {
      console.log('rejected:', r.reason.message);
    }
  });
});
// fulfilled: ok
// rejected: fail
// fulfilled: also ok
```

---

### `Promise.denodeify(fn, [length])`

*Node.js only (not available in browser build)*

Converts a Node.js-style callback function (`function(err, result)`) into a function that returns a Promise.

```js
var Promise = require('promise');
var fs = require('fs');

var readFile  = Promise.denodeify(fs.readFile);
var writeFile = Promise.denodeify(fs.writeFile);

readFile('input.json', 'utf8')
  .then(function(str) {
    var formatted = JSON.stringify(JSON.parse(str), null, 2);
    return writeFile('output.json', formatted, 'utf8');
  })
  .then(function() {
    console.log('Done!');
  })
  .catch(function(err) {
    console.error(err);
  });
```

**Parameters:**
- `fn` — A Node.js callback-style function.
- `length` *(optional)* — If provided and more arguments are passed than `length`, the extra arguments are not forwarded to `fn`.

**Behavior:** If `fn` itself returns a Promise, the state of that returned Promise is used instead of the callback.

---

### `Promise.nodeify(fn)`

*Node.js only (not available in browser build)*

Wraps a promise-returning function so it also accepts an optional Node.js-style callback as the last argument. Useful for exporting APIs that support both callbacks and promises.

```js
var Promise = require('promise');

// Internal implementation returns a promise
function internalFetch(url) {
  return new Promise(function(resolve, reject) {
    // ... async work
  });
}

// Exported API supports both styles
module.exports = Promise.nodeify(internalFetch);

// Consumers can use callbacks:
module.exports('http://example.com', function(err, result) { ... });

// Or promises:
module.exports('http://example.com').then(...);
```

---

## Instance (Prototype) Methods

### `promise.then(onFulfilled, onRejected)`

Core Promises/A+ method. Returns a new Promise.

| Scenario | Returned promise |
|----------|-----------------|
| `onFulfilled` returns a value | Fulfills with that value |
| `onFulfilled` returns a Promise | Takes on that Promise's state |
| `onFulfilled` throws | Rejects with the thrown error |
| Promise was rejected and `onRejected` handles it | Fulfills/rejects based on handler return |

```js
fetch('/api/data')
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    console.log(data);
  });
```

---

### `promise.catch(onRejected)`

Sugar for `promise.then(null, onRejected)`. Mirrors `try/catch` in synchronous code.

```js
doSomething()
  .then(function(result) {
    return processResult(result);
  })
  .catch(function(err) {
    console.error('Something failed:', err);
  });
```

---

### `promise.done(onFulfilled, onRejected)`

Similar to `.then()` but does **not** return a promise. Any unhandled error thrown inside a `.done()` handler will be thrown as an uncaught exception (crashes the process in Node.js). Use this at the end of a chain to ensure errors are never silently swallowed.

```js
doSomething()
  .then(processResult)
  .done(function(finalValue) {
    console.log('Final:', finalValue);
  }, function(err) {
    // This re-throws — does NOT swallow the error
    throw err;
  });
```

---

### `promise.nodeify(callback)`

*Node.js only*

Instance method version. If `callback` is provided and is a function, calls it with Node.js `(err, result)` convention. If no callback is provided, returns the promise itself.

```js
function getUser(id, callback) {
  return db.findUser(id)
    .then(transform)
    .nodeify(callback);
}

// Use as promise:
getUser(42).then(console.log);

// Use as callback:
getUser(42, function(err, user) {
  if (err) throw err;
  console.log(user);
});
```

---

## Deprecated / Alias Methods

| Method | Status | Notes |
|--------|--------|-------|
| `Promise.from(value)` | Deprecated | Alias for `Promise.resolve()` |
| `Promise.cast(value)` | Deprecated | Alias for `Promise.resolve()` |

These convert values and foreign promise-like objects ("thenables") into a proper `then/promise` Promise.
