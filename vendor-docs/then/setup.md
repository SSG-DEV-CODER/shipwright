# then/promise — Setup & Installation

<!-- Source: https://github.com/then/promise | https://www.npmjs.com/package/promise -->

## Overview

`promise` (published under the `then` GitHub organization) is a bare-bones Promises/A+ implementation for JavaScript. It is a superset of ES6 Promises with useful Node.js extensions like `denodeify`, `nodeify`, and `allSettled`.

- **npm package**: `promise`
- **GitHub**: `https://github.com/then/promise`
- **Spec**: Promises/A+ compliant
- **Current stable**: 8.x

---

## Installation

```bash
# npm
npm install promise

# yarn
yarn add promise

# bun
bun add promise
```

---

## Basic Import / Require

### CommonJS (Node.js)

```js
var Promise = require('promise');
```

### ES Modules / TypeScript

```ts
import Promise from 'promise';
```

> **Note**: In modern Node.js (v12+) or environments that already have a native `Promise` global, you can use the built-in Promise. This package is most useful when you need polyfill support or the Node.js-specific extensions (`denodeify`, `nodeify`, `allSettled`).

---

## Browser (UMD / Browserify)

The package works with Browserify and Webpack. The browser build strips out Node.js-specific extensions (`nodeify`, `denodeify`) automatically.

```bash
browserify your-file.js -o bundle.js
```

Or require the polyfill variant:

```js
// Polyfills the global Promise if not already defined
require('promise/polyfills');
```

---

## Quick Start Example

```js
var Promise = require('promise');

// Creating a promise from scratch
var promise = new Promise(function(resolve, reject) {
  // Simulate async work
  setTimeout(function() {
    resolve('Hello, World!');
  }, 100);
});

promise.then(function(value) {
  console.log(value); // "Hello, World!"
}).catch(function(err) {
  console.error(err);
});
```

---

## Converting a Node.js Callback Function

```js
var Promise = require('promise');
var fs = require('fs');

// Wrap fs.readFile so it returns a Promise
var readFile = Promise.denodeify(fs.readFile);

readFile('package.json', 'utf8')
  .then(function(contents) {
    console.log(contents);
  })
  .catch(function(err) {
    console.error('Failed to read file:', err);
  });
```

---

## TypeScript Support

The package ships with TypeScript declarations (`index.d.ts`):

```ts
import Promise from 'promise';

const p = new Promise<string>((resolve, reject) => {
  resolve('typed!');
});

p.then((val: string) => console.log(val));
```
