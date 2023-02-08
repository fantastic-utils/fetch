# @fantastic-utils/fetch

A library wrapper for native `fetch` function, which support more features like `axios`

[![NPM version](https://img.shields.io/npm/v/@fantastic-utils/fetch.svg?style=flat)](https://npmjs.org/package/@fantastic-utils/fetch)
[![NPM downloads](http://img.shields.io/npm/dm/@fantastic-utils/fetch.svg?style=flat)](https://npmjs.org/package/@fantastic-utils/fetch)

## Installation

`npm install @fantastic-utils/fetch`

## Fetch usage

```javascript
import createFetchInstance from `@fantastic-utils/fetch`;

// create instance and config
const fetch = createFetchInstance();
const fetch = createFetchInstance({ /* some default options */ });
const fetch = createFetchInstance({ /* some default options */ }, {/* some config */});
// For request intercept
fetch.interceptors.request.push(() => {});
// For response intercept
fetch.interceptors.response.push((data) => Promise.resolve(data)); // should return Promise;
// For errorHandler intercept
fetch.interceptors.errorHandler.push((err) => { console.error(err); });
fetch.interceptors.errorHandler.push(console.error);
// For finally intercept
fetch.interceptors.finally.push(() => {});

// Raw fetch like usage
fetch('/abc', { method: 'post', headers: {}, body: 'abc' });

// Axios like usage
fetch.get('/abc');
fetch.post('/abc', { body: JSON.stringify({ a: 1}) });
fetch.post('/abc', { body: new FormData() }, 'arrayBuffer');
// etc...

// Cancel Request, only worked for which browser support `AbortController`, otherwise ineffective。
const fetchPromise = fetch.get('/abc');
fetchPromise.cancel();
```

### Api doc

- Class `Fetch`: `const fetch = createFetchInstance(opts, config)`
  - `opts`: The default options for every request, detail please refer w3c `fetch`.
- Instance function: `get`, `post`, `put`, `delete` have same params. (e.g. `get(url, opts, respType)`)
  - `url`: The request url,
  - `opts`: The same as w3c `fetch`
  - `respType`: The response type, default `json`, support`json`, `text`, `formData`, `blob`, `arrayBuffer`.

### Browser support

Based on `Proxy` and `AbortController` doesn't support `IE`.
