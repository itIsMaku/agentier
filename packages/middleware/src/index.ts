/**
 * @module @agentier/middleware
 *
 * A collection of composable middleware functions for the Agentier agent
 * pipeline. Each middleware wraps a specific cross-cutting concern --
 * logging, retry, rate limiting, or caching -- and can be combined freely.
 *
 * @example
 * ```ts
 * import {
 *   logMiddleware,
 *   retryMiddleware,
 *   rateLimitMiddleware,
 *   cacheMiddleware,
 * } from '@agentier/middleware'
 *
 * const agent = createAgent({
 *   middleware: [
 *     logMiddleware(),
 *     retryMiddleware({ maxRetries: 3 }),
 *     rateLimitMiddleware({ rpm: 60 }),
 *     cacheMiddleware({ ttl: 60_000 }),
 *   ],
 * })
 * ```
 */

export { logMiddleware } from './log'
export type { LogMiddlewareOptions } from './log'

export { retryMiddleware } from './retry'
export type { RetryMiddlewareOptions } from './retry'

export { rateLimitMiddleware } from './rate-limit'
export type { RateLimitMiddlewareOptions } from './rate-limit'

export { cacheMiddleware } from './cache'
export type { CacheMiddlewareOptions } from './cache'
