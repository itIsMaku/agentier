import type { Middleware, AgentActionType } from '@agentier/core'

/**
 * Configuration options for the logging middleware.
 */
export interface LogMiddlewareOptions {
    /**
     * Action types to log. When provided, only matching actions are logged.
     * If omitted, all actions are logged.
     *
     * @example
     * ```ts
     * { actions: ['model_call', 'tool_call'] }
     * ```
     */
    actions?: AgentActionType[]

    /**
     * Logger instance to use for output. Must implement `log` and `error` methods.
     * Defaults to the global `console`.
     *
     * @default console
     */
    logger?: Pick<Console, 'log' | 'error'>
}

/**
 * Creates a middleware that logs agent actions with timing information.
 *
 * Each action is logged at the start and on completion (or failure) with
 * elapsed time in milliseconds. Output is prefixed with `[agentier]`.
 *
 * @param options - Optional configuration for filtering and logger selection.
 * @returns A {@link Middleware} function that logs actions passing through the pipeline.
 *
 * @example
 * ```ts
 * import { logMiddleware } from '@agentier/middleware'
 *
 * const agent = createAgent({
 *   middleware: [
 *     logMiddleware({ actions: ['model_call', 'tool_call'] }),
 *   ],
 * })
 * ```
 */
export function logMiddleware(options?: LogMiddlewareOptions): Middleware {
    const { actions, logger = console } = options ?? {}

    return async (action, next) => {
        if (actions && !actions.includes(action.type)) {
            return next()
        }

        const start = Date.now()

        const summary = formatAction(action)
        logger.log(`[agentier] ${action.type} ${summary}`)

        try {
            const result = await next()
            logger.log(`[agentier] ${action.type} done (${Date.now() - start}ms)`)
            return result
        } catch (error) {
            logger.error(`[agentier] ${action.type} failed (${Date.now() - start}ms)`, error)
            throw error
        }
    }
}

/**
 * Produces a human-readable summary string for a given action.
 *
 * @internal
 * @param action - The action to format, containing a `type` and `payload`.
 * @returns A short summary string (e.g. `"model=gpt-4"` or `"tool=search"`).
 */
function formatAction(action: { type: string; payload: Record<string, unknown> }): string {
    const p = action.payload
    switch (action.type) {
        case 'model_call':
            return `model=${p.model}`
        case 'tool_call':
            return `tool=${p.name}`
        case 'tool_result':
            return `tool=${p.name} duration=${p.duration}ms`
        case 'error':
            return `source=${p.source} ${p.name ? `tool=${p.name}` : ''}`
        default:
            return ''
    }
}
