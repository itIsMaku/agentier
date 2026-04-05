# Middleware

Middleware lets you intercept and transform every action flowing through the agent loop - model calls, tool executions, errors, and lifecycle events.

## How It Works

Agentier uses an action-based middleware system with an onion pattern. Every significant event in the agent loop is represented as an **action** with a `type` and `payload`. Each middleware receives the action and a `next()` function:

```ts
const myMiddleware: Middleware = async (action, next) => {
    // Before: inspect or modify the action
    console.log('Before:', action.type)

    const result = await next() // pass to next middleware (or core handler)

    // After: inspect or modify the result
    console.log('After:', result.type)

    return result
}
```

Calling `next()` passes control to the next middleware in the chain. The last middleware calls the core handler. The result flows back through the chain in reverse order - just like Express/Koa middleware.

## Action Types

| Action           | When                     | Payload                               |
| ---------------- | ------------------------ | ------------------------------------- |
| `loop_start`     | Agent run begins         | `{ prompt, config }`                  |
| `loop_end`       | Agent run ends           | `{ result, reason }`                  |
| `model_call`     | Before calling the model | `{ messages, tools, model }`          |
| `model_response` | After model responds     | `{ response, usage }`                 |
| `tool_call`      | Before executing a tool  | `{ id, name, arguments }`             |
| `tool_result`    | After tool returns       | `{ id, name, result, duration }`      |
| `error`          | On error                 | `{ source, error, name?, retryable }` |

The `loop_end` action includes a `reason` field: `'complete'`, `'max_iterations'`, `'max_tokens'`, `'timeout'`, or `'aborted'`.

## Using Middleware

Pass middleware to `createAgent` as an array. They execute in order (first middleware is the outermost layer):

```ts
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'
import { logMiddleware, retryMiddleware } from '@agentier/middleware'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    middleware: [logMiddleware(), retryMiddleware({ maxRetries: 3 })],
})
```

## Built-in Middleware

### logMiddleware

Logs actions with timing information. Filter to specific action types to reduce noise:

```ts
import { logMiddleware } from '@agentier/middleware'

// Log everything
logMiddleware()

// Log only model and tool calls
logMiddleware({ actions: ['model_call', 'tool_call', 'tool_result'] })

// Use a custom logger
logMiddleware({ logger: myLogger })
```

Output looks like:

```
[agentier] model_call model=gpt-4o
[agentier] model_call done (1243ms)
[agentier] tool_call tool=search
[agentier] tool_result tool=search duration=89ms
```

| Option    | Default           | Description                           |
| --------- | ----------------- | ------------------------------------- |
| `actions` | `undefined` (all) | Action types to log                   |
| `logger`  | `console`         | Object with `log` and `error` methods |

### retryMiddleware

Automatically retries failed actions with configurable backoff:

```ts
import { retryMiddleware } from '@agentier/middleware'

retryMiddleware({
    maxRetries: 5,
    retryOn: ['model_call'], // which actions to retry (default: ['model_call'])
    backoff: 'exponential', // 'fixed' | 'exponential' (default: 'exponential')
    baseDelay: 500, // base delay in ms (default: 1000)
})
```

With exponential backoff and `baseDelay: 1000`, delays are: 1s, 2s, 4s, 8s, ...

| Option       | Default          | Description            |
| ------------ | ---------------- | ---------------------- |
| `maxRetries` | `3`              | Maximum retry attempts |
| `retryOn`    | `['model_call']` | Action types to retry  |
| `backoff`    | `'exponential'`  | Backoff strategy       |
| `baseDelay`  | `1000`           | Base delay in ms       |

### rateLimitMiddleware

Enforces a per-minute request limit using a sliding window:

```ts
import { rateLimitMiddleware } from '@agentier/middleware'

rateLimitMiddleware({
    rpm: 60, // requests per minute
    limitOn: ['model_call'], // which actions to throttle (default: ['model_call'])
})
```

When the limit is reached, subsequent calls are delayed until the oldest request falls outside the 60-second window.

| Option    | Default          | Description              |
| --------- | ---------------- | ------------------------ |
| `rpm`     | (required)       | Max requests per minute  |
| `limitOn` | `['model_call']` | Action types to throttle |

### cacheMiddleware

Caches action results in memory with TTL-based eviction:

```ts
import { cacheMiddleware } from '@agentier/middleware'

cacheMiddleware({
    ttl: 60_000, // cache lifetime in ms (default: 5 min)
    maxEntries: 50, // max cache size (default: 100)
})
```

By default, it caches `model_call` actions keyed by `{ model, messages, tools }`. Identical requests return instantly from cache.

Custom cache key function:

```ts
cacheMiddleware({
    keyFn: (action) => {
        if (action.type !== 'model_call') return null // null = skip caching
        const p = action.payload as { model: string; messages: unknown[] }
        return `${p.model}:${JSON.stringify(p.messages)}`
    },
})
```

| Option       | Default                    | Description                 |
| ------------ | -------------------------- | --------------------------- |
| `ttl`        | `300_000` (5 min)          | Cache entry lifetime in ms  |
| `maxEntries` | `100`                      | Maximum cached entries      |
| `keyFn`      | built-in (model_call only) | Custom cache key derivation |

## Combining Middleware

Order matters. Middleware wraps from outside in, so the first middleware in the array is the outermost layer:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    middleware: [
        logMiddleware(), // 1. logs everything
        rateLimitMiddleware({ rpm: 60 }), // 2. throttles before hitting the API
        retryMiddleware({ maxRetries: 3 }), // 3. retries failures
        cacheMiddleware({ ttl: 60_000 }), // 4. serves from cache if available
    ],
})
```

## Writing Custom Middleware

A middleware is a function with this signature:

```ts
type Middleware = (action: AgentAction, next: () => Promise<AgentAction>) => Promise<AgentAction>
```

### Example: Duration Tracker

Track how long each model call takes:

```ts
import type { Middleware } from '@agentier/core'

const durationMiddleware: Middleware = async (action, next) => {
    if (action.type !== 'model_call') {
        return next()
    }

    const start = Date.now()
    const result = await next()
    const duration = Date.now() - start

    console.log(`Model call took ${duration}ms`)

    return result
}
```

### Example: Token Budget Guard

Abort the run if token usage exceeds a budget:

```ts
import type { Middleware } from '@agentier/core'

function tokenBudgetMiddleware(budget: number): Middleware {
    let totalTokens = 0

    return async (action, next) => {
        const result = await next()

        if (action.type === 'model_response') {
            const payload = result.payload as {
                usage: { inputTokens: number; outputTokens: number }
            }
            totalTokens += payload.usage.inputTokens + payload.usage.outputTokens

            if (totalTokens > budget) {
                throw new Error(`Token budget exceeded: ${totalTokens} > ${budget}`)
            }
        }

        return result
    }
}
```

### Example: Action Filter

Skip tool calls for specific tools:

```ts
import type { Middleware } from '@agentier/core'

function blockToolMiddleware(toolName: string): Middleware {
    return async (action, next) => {
        if (action.type === 'tool_call') {
            const payload = action.payload as { name: string }
            if (payload.name === toolName) {
                throw new Error(`Tool "${toolName}" is blocked by middleware`)
            }
        }
        return next()
    }
}
```
