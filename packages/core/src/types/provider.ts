import type { Message, ToolCall } from './message'
import type { ToolJsonSchema } from './tool'

/**
 * Parameters for a chat completion request sent to a model provider.
 */
export interface ChatParams {
    /** The model identifier (e.g. `'gpt-4o'`, `'claude-sonnet-4-20250514'`). */
    model: string
    /** The conversation messages to send to the model. */
    messages: Message[]
    /** Tool definitions available for the model to call. When omitted, no tools are provided. */
    tools?: ToolJsonSchema[]
    /** Sampling temperature (0-2). Lower values are more deterministic, higher values more creative. */
    temperature?: number
    /** Nucleus sampling parameter. Only tokens with cumulative probability up to `topP` are considered. */
    topP?: number
    /** Maximum number of tokens the model may generate in its response. */
    maxOutputTokens?: number
    /**
     * Constrains the model output to conform to a JSON schema.
     * When set, the model will produce structured JSON output.
     */
    responseFormat?: {
        /** The format type. Currently only `'json_schema'` is supported. */
        type: 'json_schema'
        /** The JSON Schema the model output must conform to. */
        schema: Record<string, unknown>
    }
    /** An abort signal that cancels the in-flight request when triggered. */
    signal?: AbortSignal
}

/**
 * The complete response returned by a model provider after a non-streaming chat call.
 */
export interface ModelResponse {
    /** The text content of the model's response, or `null` if the response is tool-calls only. */
    content: string | null
    /** Any tool calls the model requested. Empty array when the model did not invoke tools. */
    toolCalls: ToolCall[]
    /** Token usage statistics for this request. */
    usage: {
        /** The number of tokens in the input (prompt). */
        inputTokens: number
        /** The number of tokens in the output (completion). */
        outputTokens: number
    }
    /** The raw, provider-specific response object for advanced use cases. */
    raw?: unknown
}

/**
 * Events emitted during a streaming model response.
 *
 * - `token` - A chunk of generated text.
 * - `tool_call_start` - The model has begun a tool call.
 * - `tool_call_delta` - An incremental chunk of tool call arguments.
 * - `tool_call_end` - The tool call is complete with fully assembled arguments.
 * - `done` - The stream has finished; includes the full {@link ModelResponse}.
 * - `error` - An error occurred during streaming.
 */
export type StreamEvent =
    | { type: 'token'; text: string }
    | { type: 'tool_call_start'; id: string; name: string }
    | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
    | { type: 'tool_call_end'; id: string; call: ToolCall }
    | { type: 'done'; response: ModelResponse }
    | { type: 'error'; error: Error }

/**
 * Interface that model providers must implement to be used with the agent.
 *
 * A provider adapts a specific LLM API (OpenAI, Anthropic, etc.) into the
 * common interface the agent loop expects.
 *
 * @example
 * ```ts
 * const provider: ModelProvider = {
 *   name: 'openai',
 *   async chat(params) { ... },
 *   async *stream(params) { ... },
 * }
 * ```
 */
export interface ModelProvider {
    /** A human-readable name identifying this provider (e.g. `'openai'`, `'anthropic'`). */
    readonly name: string
    /**
     * Sends a chat completion request and returns the full response.
     *
     * @param params - The chat request parameters including model, messages, and tools.
     * @returns A promise resolving to the model's complete response.
     */
    chat(params: ChatParams): Promise<ModelResponse>
    /**
     * Sends a chat completion request and returns a stream of incremental events.
     *
     * @param params - The chat request parameters including model, messages, and tools.
     * @returns An async iterable of {@link StreamEvent} objects.
     */
    stream(params: ChatParams): AsyncIterable<StreamEvent>
}
