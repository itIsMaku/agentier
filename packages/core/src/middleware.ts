import type { AgentAction, AgentActionType, Middleware } from './types'

/**
 * Creates a new {@link AgentAction} with the given type, payload, and optional metadata.
 *
 * The `timestamp` is automatically set to the current time (`Date.now()`).
 *
 * @typeParam T - The specific action type being created.
 * @param type - The action type discriminator.
 * @param payload - The type-safe payload for this action.
 * @param metadata - Optional arbitrary metadata to attach to the action.
 * @returns A new {@link AgentAction} instance.
 *
 * @example
 * ```ts
 * const action = createAction('tool_call', {
 *   id: 'call_1',
 *   name: 'search',
 *   arguments: { query: 'hello' },
 * })
 * ```
 */
export function createAction<T extends AgentActionType>(
    type: T,
    payload: AgentAction<T>['payload'],
    metadata: Record<string, unknown> = {},
): AgentAction<T> {
    return {
        type,
        payload,
        timestamp: Date.now(),
        metadata,
    }
}

/**
 * Executes an action through a chain of middleware functions using the "onion" pattern.
 *
 * Each middleware receives the action and a `next()` function. Calling `next()`
 * passes control to the subsequent middleware, or to the core `execute` handler
 * if all middleware has been traversed. Middleware can inspect, modify, or
 * short-circuit the action before or after calling `next()`.
 *
 * @param middlewares - The ordered list of middleware functions to run.
 * @param action - The action to process through the chain.
 * @param execute - The core handler invoked after all middleware has run.
 * @returns A promise resolving to the final (possibly modified) action.
 *
 * @example
 * ```ts
 * const result = await runMiddlewareChain(
 *   [loggingMiddleware, metricsMiddleware],
 *   action,
 *   async () => coreHandler(action),
 * )
 * ```
 */
export async function runMiddlewareChain(
    middlewares: Middleware[],
    action: AgentAction,
    execute: () => Promise<AgentAction>,
): Promise<AgentAction> {
    if (middlewares.length === 0) {
        return execute()
    }

    let index = 0

    const next = async (): Promise<AgentAction> => {
        if (index >= middlewares.length) {
            return execute()
        }
        const mw = middlewares[index++]
        return mw(action, next)
    }

    return next()
}
