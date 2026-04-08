import type { ZodType } from 'zod'
import type { Message } from './message'
import type { ModelProvider } from './provider'
import type { Tool } from './tool'
import type { Middleware } from './middleware'
import type { MemoryProvider } from './memory'

/**
 * Configuration options for creating an agent via {@link createAgent}.
 *
 * @example
 * ```ts
 * const config: AgentConfig = {
 *   model: 'gpt-4o',
 *   provider: openaiProvider,
 *   systemPrompt: 'You are a helpful assistant.',
 *   tools: [searchTool, calculatorTool],
 *   maxIterations: 15,
 * }
 * ```
 */
export interface AgentConfig {
    /** The model identifier to use for completions (e.g. `'gpt-4o'`, `'claude-sonnet-4-20250514'`). */
    model: string
    /** The model provider implementation that handles API communication. */
    provider: ModelProvider
    /** An optional system prompt prepended to the conversation to guide the model's behavior. */
    systemPrompt?: string
    /** Tools available for the agent to invoke during its reasoning loop. */
    tools?: Tool[]
    /** Middleware functions that intercept and can transform actions in the agent loop. */
    middleware?: Middleware[]
    /** A memory provider for persisting conversation history across sessions. */
    memory?: MemoryProvider
    /** Maximum number of model call iterations before the loop terminates. Defaults to `10`. */
    maxIterations?: number
    /** Maximum total token usage before the loop terminates. Defaults to `Infinity`. */
    maxTokens?: number
    /** Maximum wall-clock time in milliseconds before the loop is aborted. Defaults to `60000`. */
    timeout?: number
    /** Default sampling temperature for model calls. Can be overridden per-run. */
    temperature?: number
    /** Default nucleus sampling parameter for model calls. */
    topP?: number
    /** Default maximum output tokens for model responses. Can be overridden per-run. */
    maxOutputTokens?: number
}

/**
 * A record of a single tool call that was executed during an agent run,
 * including its arguments, result, and timing.
 */
export interface ExecutedToolCall {
    /** The unique identifier of the tool call. */
    id: string
    /** The name of the tool that was called. */
    name: string
    /** The arguments that were passed to the tool. */
    arguments: Record<string, unknown>
    /** The value returned by the tool (or an error message string if execution failed). */
    result: unknown
    /** How long the tool execution took, in milliseconds. */
    duration: number
}

/**
 * Aggregated token usage statistics for an agent run.
 */
export interface UsageStats {
    /** Total tokens consumed (input + output). */
    totalTokens: number
    /** Total input (prompt) tokens across all model calls. */
    inputTokens: number
    /** Total output (completion) tokens across all model calls. */
    outputTokens: number
    /** The number of model call iterations performed. */
    iterations: number
    /** An optional estimated monetary cost for the run. */
    estimatedCost?: number
}

/**
 * The result returned after an agent completes a run.
 *
 * @typeParam T - The type of the output. Defaults to `string`, but when an
 *   `outputSchema` is provided it will be the validated type.
 */
export interface AgentResult<T = string> {
    /** The final output produced by the agent. */
    output: T
    /** The complete conversation history including all messages exchanged during the run. */
    messages: Message[]
    /** All tool calls that were executed during the run. */
    toolCalls: ExecutedToolCall[]
    /** Aggregated token usage statistics. */
    usage: UsageStats
    /** Total wall-clock duration of the run in milliseconds. */
    duration: number
}

/**
 * Options that can be passed to {@link Agent.run} to customize a single run.
 *
 * @typeParam T - The expected output type. When `outputSchema` is provided,
 *   the agent will parse and validate the model's response into this type.
 */
export interface RunOptions<T = string> {
    /** Model identifier override for this run. Overrides {@link AgentConfig.model}. */
    model?: string
    /** Initial messages to prepend to the conversation (overrides memory loading). */
    messages?: Message[]
    /**
     * A Zod schema for structured output. When provided, the agent instructs the model
     * to respond with JSON conforming to this schema and validates the result.
     */
    outputSchema?: ZodType<T>
    /** Sampling temperature override for this run. */
    temperature?: number
    /** Maximum output tokens override for this run. */
    maxOutputTokens?: number
    /**
     * Callback invoked for each text token as it streams from the model.
     *
     * @param token - The text chunk received.
     */
    onToken?: (token: string) => void
    /**
     * Callback invoked when the model requests a tool call.
     *
     * @param name - The name of the tool being called.
     * @param args - The arguments passed to the tool.
     */
    onToolCall?: (name: string, args: Record<string, unknown>) => void
    /**
     * Callback invoked when a tool returns a result.
     *
     * @param name - The name of the tool that returned.
     * @param result - The value produced by the tool.
     */
    onToolResult?: (name: string, result: unknown) => void
    /**
     * Callback invoked when the agent run completes successfully.
     *
     * @param result - The final agent result.
     */
    onComplete?: (result: AgentResult<T>) => void
    /**
     * Callback invoked when the agent run encounters an error.
     *
     * @param error - The error that occurred.
     */
    onError?: (error: Error) => void
    /** Maximum number of model call iterations for this run. Overrides {@link AgentConfig.maxIterations}. */
    maxIterations?: number
    /** Maximum total token budget for this run. Overrides {@link AgentConfig.maxTokens}. */
    maxTokens?: number
    /** Maximum wall-clock time in milliseconds for this run. Overrides {@link AgentConfig.timeout}. */
    timeout?: number
    /** An external abort signal to cancel the run. */
    signal?: AbortSignal
    /** The session ID used for memory persistence. Defaults to `'default'`. */
    sessionId?: string
    /** When `true`, skips saving the conversation to memory after the run completes. */
    skipMemorySave?: boolean
}

/**
 * The public interface of an agent created by {@link createAgent}.
 */
export interface Agent {
    /**
     * Runs the agent with the given prompt and returns the result.
     *
     * @typeParam T - The output type. Defaults to `string`; when `outputSchema` is
     *   provided in options, it matches the schema's output type.
     * @param prompt - The user message to send to the agent.
     * @param options - Optional run-time configuration and callbacks.
     * @returns A promise resolving to the agent's result including output, messages, and usage stats.
     *
     * @example
     * ```ts
     * const result = await agent.run('What is the weather in Berlin?')
     * console.log(result.output)
     * ```
     */
    run<T = string>(prompt: string, options?: RunOptions<T>): Promise<AgentResult<T>>
    /**
     * Returns a frozen (read-only) copy of the agent's configuration.
     *
     * @returns The agent's configuration object.
     */
    getConfig(): Readonly<AgentConfig>
}
