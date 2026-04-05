import type { Middleware, AgentActionType } from '@agentier/core'

/**
 * Configuration options for the rate-limiting middleware.
 */
export interface RateLimitMiddlewareOptions {
    /**
     * Maximum number of requests permitted per minute (rolling window).
     */
    rpm: number

    /**
     * Action types subject to rate limiting.
     * Actions whose type is not in this list pass through without throttling.
     *
     * @default ['model_call']
     */
    limitOn?: AgentActionType[]
}

/**
 * Creates a middleware that enforces a per-minute request rate limit using a
 * sliding window. When the limit is reached, subsequent calls are delayed
 * until the oldest tracked request falls outside the 60-second window.
 *
 * @param options - Configuration specifying the rate cap and target action types.
 * @returns A {@link Middleware} function that throttles actions in the pipeline.
 *
 * @example
 * ```ts
 * import { rateLimitMiddleware } from '@agentier/middleware'
 *
 * const agent = createAgent({
 *   middleware: [
 *     rateLimitMiddleware({ rpm: 60, limitOn: ['model_call'] }),
 *   ],
 * })
 * ```
 */
export function rateLimitMiddleware(options: RateLimitMiddlewareOptions): Middleware {
    const { rpm, limitOn = ['model_call'] } = options

    /** Length of the sliding window in milliseconds (60 seconds). */
    const windowMs = 60_000

    /** Sorted list of timestamps (epoch ms) for requests within the current window. */
    const timestamps: number[] = []

    return async (action, next) => {
        if (!limitOn.includes(action.type)) {
            return next()
        }

        const now = Date.now()

        /** Remove timestamps that have fallen outside the sliding window. */
        while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
            timestamps.shift()
        }

        /** If the window is full, sleep until the oldest timestamp expires. */
        if (timestamps.length >= rpm) {
            const waitUntil = timestamps[0] + windowMs
            const waitMs = waitUntil - now
            if (waitMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, waitMs))
            }
            /** Remove any timestamps that expired while we were waiting. */
            while (timestamps.length > 0 && timestamps[0] <= Date.now() - windowMs) {
                timestamps.shift()
            }
        }

        timestamps.push(Date.now())
        return next()
    }
}
