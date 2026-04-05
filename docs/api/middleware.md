# @agentier/middleware

A collection of composable middleware functions for the agentier agent pipeline. Each middleware wraps a specific cross-cutting concern and can be combined freely.

## Functions

### `logMiddleware(options?)`

Creates a middleware that logs agent actions with timing information. Each action is logged at the start and on completion (or failure) with elapsed time. Output is prefixed with `[agentier]`.

```ts
function logMiddleware(options?: LogMiddlewareOptions): Middleware
```

**Example:**

```ts
import { logMiddleware } from '@agentier/middleware'

const agent = createAgent({
    middleware: [logMiddleware({ actions: ['model_call', 'tool_call'] })],
})
```

---

### `retryMiddleware(options?)`

Creates a middleware that automatically retries failed actions. When an action whose type is listed in `retryOn` throws, the middleware re-invokes the downstream pipeline up to `maxRetries` times with configurable backoff. If all attempts fail, the last error is re-thrown.

```ts
function retryMiddleware(options?: RetryMiddlewareOptions): Middleware
```

**Example:**

```ts
import { retryMiddleware } from '@agentier/middleware'

const agent = createAgent({
    middleware: [retryMiddleware({ maxRetries: 5, backoff: 'exponential', baseDelay: 500 })],
})
```

---

### `rateLimitMiddleware(options)`

Creates a middleware that enforces a per-minute request rate limit using a sliding window. When the limit is reached, subsequent calls are delayed until the oldest tracked request falls outside the 60-second window.

```ts
function rateLimitMiddleware(options: RateLimitMiddlewareOptions): Middleware
```

**Example:**

```ts
import { rateLimitMiddleware } from '@agentier/middleware'

const agent = createAgent({
    middleware: [rateLimitMiddleware({ rpm: 60 })],
})
```

---

### `cacheMiddleware(options?)`

Creates a middleware that caches action results in memory using a TTL + max-size eviction strategy. Identical actions (as determined by their cache key) that hit a live cache entry are returned immediately without invoking the downstream pipeline.

```ts
function cacheMiddleware(options?: CacheMiddlewareOptions): Middleware
```

**Example:**

```ts
import { cacheMiddleware } from '@agentier/middleware'

const agent = createAgent({
    middleware: [cacheMiddleware({ ttl: 60_000, maxEntries: 50 })],
})
```

---

## Interfaces

### `LogMiddlewareOptions`

```ts
interface LogMiddlewareOptions {
    actions?: AgentActionType[]
    logger?: Pick<Console, 'log' | 'error'>
}
```

| Property  | Type                               | Description                                                |
| --------- | ---------------------------------- | ---------------------------------------------------------- |
| `actions` | `AgentActionType[]?`               | Action types to log. When omitted, all actions are logged. |
| `logger`  | `Pick<Console, 'log' \| 'error'>?` | Logger instance. Defaults to `console`.                    |

---

### `RetryMiddlewareOptions`

```ts
interface RetryMiddlewareOptions {
    maxRetries?: number
    retryOn?: AgentActionType[]
    backoff?: 'fixed' | 'exponential'
    baseDelay?: number
}
```

| Property     | Type                        | Default          | Description                                                                                 |
| ------------ | --------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `maxRetries` | `number?`                   | `3`              | Maximum retry attempts after the initial failure.                                           |
| `retryOn`    | `AgentActionType[]?`        | `['model_call']` | Action types that should be retried on failure.                                             |
| `backoff`    | `'fixed' \| 'exponential'?` | `'exponential'`  | Backoff strategy. `'fixed'` waits `baseDelay` each time; `'exponential'` doubles each time. |
| `baseDelay`  | `number?`                   | `1000`           | Base delay in milliseconds for backoff calculation.                                         |

---

### `RateLimitMiddlewareOptions`

```ts
interface RateLimitMiddlewareOptions {
    rpm: number
    limitOn?: AgentActionType[]
}
```

| Property  | Type                 | Default          | Description                                             |
| --------- | -------------------- | ---------------- | ------------------------------------------------------- |
| `rpm`     | `number`             | _(required)_     | Maximum requests permitted per minute (rolling window). |
| `limitOn` | `AgentActionType[]?` | `['model_call']` | Action types subject to rate limiting.                  |

---

### `CacheMiddlewareOptions`

```ts
interface CacheMiddlewareOptions {
    ttl?: number
    maxEntries?: number
    keyFn?: (action: AgentAction) => string | null
}
```

| Property     | Type                                      | Default          | Description                                                                                                                  |
| ------------ | ----------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ttl`        | `number?`                                 | `300000` (5 min) | Time-to-live for cached entries in milliseconds.                                                                             |
| `maxEntries` | `number?`                                 | `100`            | Maximum number of cache entries. Oldest entry is evicted when exceeded.                                                      |
| `keyFn`      | `(action: AgentAction) => string \| null` | _(built-in)_     | Custom cache key function. Return `null` to skip caching. Default caches `model_call` actions by model, messages, and tools. |
