import type { AgentConfig, AgentResult } from './agent'
import type { Message, ToolCall } from './message'
import type { ModelResponse, ToolJsonSchema } from '../types'

/**
 * The discriminated set of action types that flow through the middleware pipeline.
 *
 * - `'loop_start'` - The agent loop has begun processing a prompt.
 * - `'loop_end'` - The agent loop has finished (successfully or due to a limit).
 * - `'model_call'` - A request is about to be sent to the model provider.
 * - `'model_response'` - A response has been received from the model provider.
 * - `'tool_call'` - A tool is about to be invoked.
 * - `'tool_result'` - A tool has returned a result.
 * - `'error'` - An error occurred during model or tool execution.
 */
export type AgentActionType =
    | 'loop_start'
    | 'loop_end'
    | 'model_call'
    | 'model_response'
    | 'tool_call'
    | 'tool_result'
    | 'error'

/**
 * Maps each {@link AgentActionType} to its corresponding payload shape.
 * Used to provide type-safe payloads on {@link AgentAction}.
 */
export interface ActionPayloadMap {
    /** Payload for the `loop_start` action. */
    loop_start: {
        /** The user prompt that initiated the loop. */
        prompt: string
        /** The agent configuration in effect. */
        config: AgentConfig
    }
    /** Payload for the `loop_end` action. */
    loop_end: {
        /** The final result produced by the agent. */
        result: AgentResult
        /** The reason the loop ended. */
        reason: 'complete' | 'max_iterations' | 'max_tokens' | 'timeout' | 'aborted'
    }
    /** Payload for the `model_call` action. */
    model_call: {
        /** The messages being sent to the model. */
        messages: Message[]
        /** The tool definitions being sent to the model. */
        tools: ToolJsonSchema[]
        /** The model identifier being called. */
        model: string
    }
    /** Payload for the `model_response` action. */
    model_response: {
        /** The model's response. */
        response: ModelResponse
        /** Token usage for this call. */
        usage: { inputTokens: number; outputTokens: number }
    }
    /** Payload for the `tool_call` action. */
    tool_call: {
        /** The tool call ID. */
        id: string
        /** The name of the tool being called. */
        name: string
        /** The arguments passed to the tool. */
        arguments: Record<string, unknown>
    }
    /** Payload for the `tool_result` action. */
    tool_result: {
        /** The tool call ID this result corresponds to. */
        id: string
        /** The name of the tool that was called. */
        name: string
        /** The value returned by the tool. */
        result: unknown
        /** How long the tool execution took, in milliseconds. */
        duration: number
    }
    /** Payload for the `error` action. */
    error: {
        /** Where the error originated. */
        source: 'model' | 'tool' | 'internal'
        /** The error that occurred. */
        error: Error
        /** The name of the tool, if the error originated from a tool. */
        name?: string
        /** Whether the operation that caused this error can be retried. */
        retryable: boolean
    }
}

/**
 * A typed action object that flows through the middleware pipeline.
 * Each action carries a discriminated type, its payload, a timestamp, and arbitrary metadata.
 *
 * @typeParam T - The specific {@link AgentActionType} this action represents.
 */
export interface AgentAction<T extends AgentActionType = AgentActionType> {
    /** The action type discriminator. */
    type: T
    /** The type-safe payload associated with this action. */
    payload: T extends keyof ActionPayloadMap ? ActionPayloadMap[T] : never
    /** Unix timestamp (milliseconds) when the action was created. */
    timestamp: number
    /** Arbitrary metadata attached to the action by middleware or the agent. */
    metadata: Record<string, unknown>
}

/**
 * A middleware function that intercepts actions flowing through the agent loop.
 *
 * Middleware can inspect, modify, or short-circuit actions. It follows the
 * standard "onion" pattern: call `next()` to pass control to the next
 * middleware (or the core executor), and optionally transform the result.
 *
 * @param action - The action being processed.
 * @param next - Calls the next middleware in the chain (or the core handler).
 * @returns A promise resolving to the (possibly modified) action.
 *
 * @example
 * ```ts
 * const loggingMiddleware: Middleware = async (action, next) => {
 *   console.log('Before:', action.type)
 *   const result = await next()
 *   console.log('After:', result.type)
 *   return result
 * }
 * ```
 */
export type Middleware = (
    action: AgentAction,
    next: () => Promise<AgentAction>,
) => Promise<AgentAction>
