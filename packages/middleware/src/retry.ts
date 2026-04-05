import type { Middleware, AgentActionType } from '@agentier/core'

/**
 * Configuration options for the retry middleware.
 */
export interface RetryMiddlewareOptions {
    /**
     * Maximum number of retry attempts after the initial call fails.
     *
     * @default 3
     */
    maxRetries?: number

    /**
     * Action types that should be retried on failure.
     * Actions whose type is not in this list pass through without retry logic.
     *
     * @default ['model_call']
     */
    retryOn?: AgentActionType[]

    /**
     * Backoff strategy used to calculate the delay between retries.
     *
     * - `'fixed'` -- waits `baseDelay` ms between every attempt.
     * - `'exponential'` -- waits `baseDelay * 2^attempt` ms, doubling each time.
     *
     * @default 'exponential'
     */
    backoff?: 'fixed' | 'exponential'

    /**
     * Base delay in milliseconds used for backoff calculation.
     *
     * @default 1000
     */
    baseDelay?: number
}

/**
 * Creates a middleware that automatically retries failed actions.
 *
 * When an action whose type is listed in `retryOn` throws an error, the
 * middleware re-invokes the downstream pipeline up to `maxRetries` times,
 * waiting between attempts according to the chosen `backoff` strategy.
 * If all attempts fail, the last error is re-thrown.
 *
 * @param options - Optional configuration for retry behaviour.
 * @returns A {@link Middleware} function that adds retry logic to the pipeline.
 *
 * @example
 * ```ts
 * import { retryMiddleware } from '@agentier/middleware'
 *
 * const agent = createAgent({
 *   middleware: [
 *     retryMiddleware({ maxRetries: 5, backoff: 'exponential', baseDelay: 500 }),
 *   ],
 * })
 * ```
 */
export function retryMiddleware(options?: RetryMiddlewareOptions): Middleware {
    const {
        maxRetries = 3,
        retryOn = ['model_call'],
        backoff = 'exponential',
        baseDelay = 1000,
    } = options ?? {}

    return async (action, next) => {
        if (!retryOn.includes(action.type)) {
            return next()
        }

        let lastError: Error | null = null

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await next()
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (attempt === maxRetries) break

                const delay =
                    backoff === 'exponential' ? baseDelay * Math.pow(2, attempt) : baseDelay

                await new Promise((resolve) => setTimeout(resolve, delay))
            }
        }

        throw lastError
    }
}
