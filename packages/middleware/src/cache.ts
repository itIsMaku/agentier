import type { Middleware, AgentAction } from '@agentier/core'

/**
 * Configuration options for the caching middleware.
 */
export interface CacheMiddlewareOptions {
    /**
     * Time-to-live for cached entries in milliseconds.
     * After this duration, a cached result is considered stale and will be evicted.
     *
     * @default 300000 (5 minutes)
     */
    ttl?: number

    /**
     * Maximum number of entries the cache may hold. When exceeded, the oldest
     * entry (by insertion order) is evicted.
     *
     * @default 100
     */
    maxEntries?: number

    /**
     * Custom function that derives a cache key from an action. Return `null` to
     * skip caching for that action. When omitted, a built-in key function is used
     * that caches `model_call` actions based on model, messages, and tools.
     *
     * @param action - The agent action to compute a key for.
     * @returns A string cache key, or `null` to bypass caching.
     *
     * @example
     * ```ts
     * {
     *   keyFn: (action) => action.type === 'tool_call'
     *     ? `tool:${action.payload.name}:${JSON.stringify(action.payload.args)}`
     *     : null,
     * }
     * ```
     */
    keyFn?: (action: AgentAction) => string | null
}

/**
 * Internal representation of a single cache entry.
 *
 * @internal
 */
interface CacheEntry {
    /** The cached action result. */
    result: AgentAction
    /** Epoch timestamp (ms) after which this entry is considered stale. */
    expiresAt: number
}

/**
 * Creates a middleware that caches action results in memory using a simple
 * TTL + max-size eviction strategy. Identical actions (as determined by
 * their cache key) that hit a live cache entry are returned immediately
 * without invoking the downstream pipeline.
 *
 * @param options - Optional configuration for TTL, capacity, and key derivation.
 * @returns A {@link Middleware} function that adds response caching to the pipeline.
 *
 * @example
 * ```ts
 * import { cacheMiddleware } from '@agentier/middleware'
 *
 * const agent = createAgent({
 *   middleware: [
 *     cacheMiddleware({ ttl: 60_000, maxEntries: 50 }),
 *   ],
 * })
 * ```
 */
export function cacheMiddleware(options?: CacheMiddlewareOptions): Middleware {
    const { ttl = 5 * 60 * 1000, maxEntries = 100, keyFn } = options ?? {}

    const cache = new Map<string, CacheEntry>()

    /**
     * Default key derivation function. Returns a JSON-serialised composite of
     * model, messages, and tools for `model_call` actions; returns `null` for
     * all other action types.
     *
     * @internal
     * @param action - The action to derive a key from.
     * @returns A string key or `null` if the action should not be cached.
     */
    function defaultKeyFn(action: AgentAction): string | null {
        if (action.type !== 'model_call') return null

        const payload = action.payload as {
            messages: unknown[]
            model: string
            tools: unknown[]
        }

        const key = JSON.stringify({
            model: payload.model,
            messages: payload.messages,
            tools: payload.tools,
        })

        return key
    }

    /**
     * Removes all entries whose TTL has expired.
     *
     * @internal
     */
    function evictExpired() {
        const now = Date.now()
        for (const [key, entry] of cache) {
            if (entry.expiresAt <= now) {
                cache.delete(key)
            }
        }
    }

    /**
     * Evicts the oldest entry (by insertion order) when the cache exceeds
     * {@link maxEntries}.
     *
     * @internal
     */
    function evictOldest() {
        if (cache.size <= maxEntries) return
        const firstKey = cache.keys().next().value
        if (firstKey !== undefined) {
            cache.delete(firstKey)
        }
    }

    return async (action, next) => {
        const key = keyFn ? keyFn(action) : defaultKeyFn(action)

        if (!key) {
            return next()
        }

        evictExpired()
        const cached = cache.get(key)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.result
        }

        const result = await next()

        cache.set(key, {
            result,
            expiresAt: Date.now() + ttl,
        })
        evictOldest()

        return result
    }
}
