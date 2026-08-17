# pretty-http-client

A tiny, zero-dependency HTTP client built on the native Fetch API. It adds the pieces that application code usually needs—timeouts, cancellation, retries, hooks, normalized HTTP errors, and an opt-in LRU response cache—while returning a native `Response` by default.

```bash
pnpm add pretty-http-client
```

Requires Node.js 18+ or a browser with `fetch`, `AbortController`, `URL`, and `Headers`.

## Quick start

```ts
import { createHttpClient } from "pretty-http-client";

const api = createHttpClient({
  prefix: "https://api.example.com/v1",
  alias: "primary-api",
  headers: { authorization: "Bearer token" },
});

const response = await api.get("/users", {
  searchParams: { page: 1, tag: ["admin", "active"] },
});
const users = await response.json();
```

Objects, arrays, numbers, and booleans are serialized as JSON. An explicit Content-Type header always wins. Strings and native `BodyInit` values are sent unchanged.

```ts
await api.post("/users", {
  data: { name: "Ada" },
});
```

## Errors and status validation

Responses that fail `validateStatus` throw `HttpError` after retries are exhausted. The default validator is `response.ok`.

```ts
import { HttpError } from "pretty-http-client";

try {
  await api.get("/missing");
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.code, error.status, error.request.url, error.client.alias);
    console.log(await error.response.clone().json());
  }
}
```

Built-in errors use short, stable codes as their default `message`. `HttpError` and `TimeoutError` expose the same value through `error.code`; validation and fallback errors also receive a `code` property at runtime. Error objects supplied by Fetch, hooks, or an external abort reason are preserved unchanged.

| Code | Error type | Meaning |
| --- | --- | --- |
| `E_HTTP_STATUS` | `HttpError` | The final response failed `validateStatus`. |
| `E_TIMEOUT` | `TimeoutError` | The complete logical request exceeded its timeout. |
| `E_SEARCH_PARAM` | `TypeError` | A query object could not be serialized. |
| `E_RETRY_LIMIT` | `RangeError` | `retry.limit` is not a non-negative integer. |
| `E_RETRY_DELAY` | `RangeError` | `retry.delay` is not a non-negative finite number. |
| `E_RETRY_METHOD` | `RangeError` | `retry.methods` contains an unsupported method. |
| `E_RETRY_STATUS` | `RangeError` | `retry.statusCodes` contains an invalid HTTP status. |
| `E_CACHE_TTL` | `RangeError` | A cache TTL is negative, non-finite, or has an unsupported unit. |
| `E_CACHE_SIZE` | `RangeError` | `cache.maxSize` is not a positive integer. |
| `E_TIMEOUT_OPTION` | `RangeError` | A timeout is not a positive finite number or `false`. |
| `E_PREFIX` | `TypeError` | A prefix contains a query string or hash. |
| `E_CATCH_HOOK` | `Error` | A `catchError` hook threw a value that was not an Error object. |
| `E_ABORTED` | `Error` named `AbortError` | A request was aborted without an external reason. |

Return rejected status responses instead:

```ts
const response = await api.get("/optional", {
  throwHttpErrors: false,
});
```

Or customize accepted statuses at client or request level:

```ts
const api = createHttpClient({
  validateStatus: response => response.ok || response.status === 404,
});
```

## Timeout and cancellation

The default 10-second timeout covers `beforeRequest`, all fetch attempts, and retry waits. It stops once the final response is available; `afterResponse` and `catchError` are not timed.

```ts
const api = createHttpClient({ timeout: 5_000 });

await api.get("/slow", { timeout: 1_000 });
await api.get("/unbounded", { timeout: false });

const controller = new AbortController();
const request = api.get("/report", { signal: controller.signal });
controller.abort();
await request;
```

Timeouts throw `TimeoutError`. Caller cancellation preserves the abort reason supplied by the caller.

## Retry

Retries are opt-in because the default `limit` is `0`. Once enabled, defaults are:

- methods: `get`, `head`, `put`, `delete`
- statuses: 408, 429, 500, 502, 503, 504
- fetch/network failures: enabled
- delay: 0 ms, unless the server returns `Retry-After`

```ts
const api = createHttpClient({
  retry: {
    limit: 2,
    delay: 100,
    methods: ["get", "post"],
    statusCodes: [408, 429, 500, 502, 503, 504],
    retryOnNetworkError: true,
  },
});

await api.post("/safe-operation", {
  retry: { limit: 1 }, // merges with the client policy
});

await api.get("/once", { retry: false });
```

Request arrays replace client arrays. One-shot `ReadableStream` bodies, timeouts, caller aborts, hook errors, and configuration errors are not retried.

## Hooks

Client hooks run first, followed by request hooks. All hooks are sequential and may be async. Set a request category to `false` to disable its client hooks for that request.

```ts
const api = createHttpClient({
  hooks: {
    beforeRequest: [async (_client, request) => {
      request.headers.set("x-request-id", crypto.randomUUID());
    }],
    beforeRetry: [async (_client, request, context) => {
      console.log("next attempt", context.attempt);
      request.headers.set("x-retry", String(context.attempt));
    }],
    catchError: [async (_client, request, error) => {
      console.error(request.url, error);
    }],
  },
});

await api.get("/quiet", {
  hooks: { catchError: false },
});
```

`beforeRequest` runs once per logical request. `beforeRetry` may change URL, headers, query, or data for the next attempt. `catchError` observes final failures and cannot recover with a return value.

### Response transforms

Without an `afterResponse` hook, methods return native `Response` objects. A hook pipeline may deliberately transform the value:

```ts
const api = createHttpClient({
  hooks: {
    afterResponse: [
      async (_client, _request, value) => (value as Response).json(),
      (_client, _request, value) => (value as { data: unknown }).data,
    ],
  },
});

const user = await api.get<{ name: string }>("/user/1");
```

The method generic is an assertion about the final pipeline value. The library does not parse or validate JSON automatically.

## Response cache

Automatic caching is disabled unless enabled on the client or request. Only GET and HEAD responses accepted by `validateStatus` are cached. Values are cloned when stored and read.

```ts
const api = createHttpClient({
  cache: {
    maxSize: 100,
    ttl: "5m",
  },
});

await api.get("/users", { cache: false });
await api.get("/settings", { cache: { ttl: "1h" } });
```

TTL accepts non-negative millisecond numbers or a single lowercase duration such as `"500ms"`, `"5s"`, `"1m"`, `"1.5h"`, or `"1d"`. Zero means no expiry.

The default key is `<method> <final URL>`. Customize it or opt out per request:

```ts
const api = createHttpClient({
  cache: {
    matcher: (_client, request, finalUrl) =>
      request.headers.has("authorization") ? finalUrl : false,
  },
});
```

`client.cache` exposes `get`, `set`, `delete`, `clear`, and `size` for explicit invalidation.

## URL and fetch options

- Request-level `prefix` replaces the client prefix, including with an empty string.
- Absolute request URLs bypass `prefix`.
- Prefixes may not contain query strings or hashes.
- `searchParams` replaces same-name parameters already present in the URL.
- Arrays use repeated keys; null and undefined values are omitted; nested objects use JSON.
- Native Fetch options live under `fetchOptions` so `cache` remains available for the response cache.

```ts
await api.get("/private", {
  cache: true,
  fetchOptions: {
    cache: "no-store",
    credentials: "include",
    redirect: "error",
  },
});
```

## Migrating from 1.x

| 1.x | 2.0 |
| --- | --- |
| `retryCount: 2` | `retry: { limit: 2 }` |
| `retryTimeout: 100` | `retry: { delay: 100 }` |
| `cacheSize: 100` | `cache: { maxSize: 100 }` |
| `cache: { milliseconds: 5000, matcher }` | `cache: { ttl: 5000, matcher }` |
| non-2xx returned normally | throws `HttpError`; use `throwHttpErrors: false` to retain the response |
| request hooks replaced client hooks | request hooks append; use a category value of `false` to disable client hooks |
| header records in hooks | native `Headers` |
| uppercase hook methods | lowercase `HttpMethod` |
| UMD/CJS output | standard ESM and CommonJS outputs |

The removed 1.x option names are not recognized at runtime. TypeScript will flag them during migration.

## Development

```bash
pnpm install
pnpm typecheck
pnpm coverage
pnpm build
```

Statements, branches, functions, and lines are all enforced at 100% coverage.
