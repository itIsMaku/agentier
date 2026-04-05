import type { ZodType } from 'zod'
import type { Message } from './message'

/**
 * Contextual information provided to a tool's execute function at invocation time.
 */
export interface ToolContext {
    /** The unique identifier of the current tool call. */
    callId: string
    /** An abort signal that is triggered when the agent loop is cancelled or times out. */
    signal: AbortSignal
    /** The full conversation history up to and including the assistant message that triggered this call. */
    messages: Message[]
}

/**
 * A plain JSON Schema object describing tool parameters.
 * Used as an alternative to Zod schemas when defining tools.
 *
 * @example
 * ```ts
 * const schema: JsonSchema = {
 *   type: 'object',
 *   properties: {
 *     city: { type: 'string', description: 'City name' },
 *   },
 *   required: ['city'],
 * }
 * ```
 */
export interface JsonSchema {
    /** Must be `'object'` for tool parameter schemas. */
    type: 'object'
    /** A map of property names to their JSON Schema definitions. */
    properties: Record<string, unknown>
    /** An array of property names that are required. */
    required?: string[]
    /** Additional JSON Schema keywords. */
    [key: string]: unknown
}

/**
 * The JSON representation of a tool sent to the model provider.
 * This is the wire format that model APIs expect.
 */
export interface ToolJsonSchema {
    /** The tool name as it will appear to the model. */
    name: string
    /** A human-readable description of what the tool does. */
    description: string
    /** The JSON Schema describing the tool's accepted parameters. */
    parameters: Record<string, unknown>
}

/**
 * Defines a tool that the agent can invoke during its reasoning loop.
 *
 * @typeParam TParams - The type of the validated parameters object passed to `execute`.
 * @typeParam TResult - The type of the value returned by `execute`.
 *
 * @example
 * ```ts
 * const weatherTool: Tool<{ city: string }, string> = {
 *   name: 'get_weather',
 *   description: 'Get the current weather for a city',
 *   parameters: z.object({ city: z.string() }),
 *   execute: async ({ city }) => `Sunny in ${city}`,
 * }
 * ```
 */
export interface Tool<TParams = Record<string, unknown>, TResult = unknown> {
    /** The unique name identifying this tool. */
    name: string
    /** A description of what the tool does, shown to the model to guide tool selection. */
    description: string
    /** A Zod schema or plain JSON Schema that defines and validates the tool's parameters. */
    parameters: ZodType<TParams> | JsonSchema
    /**
     * Executes the tool with validated parameters.
     *
     * @param params - The validated parameters parsed from the model's tool call arguments.
     * @param context - Contextual information including the call ID, abort signal, and message history.
     * @returns A promise resolving to the tool's result value.
     */
    execute: (params: TParams, context: ToolContext) => Promise<TResult>
    /** @internal Resolved JSON Schema representation, set by {@link defineTool} or lazily by the agent. */
    _jsonSchema?: Record<string, unknown>
    /** @internal Whether {@link parameters} is a Zod schema (as opposed to a plain JSON Schema). */
    _isZod?: boolean
}
