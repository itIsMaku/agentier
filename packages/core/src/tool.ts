import { type ZodType, ZodObject } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Tool, JsonSchema, ToolJsonSchema } from './types'

/**
 * @internal
 * Type guard that checks whether a value is a Zod schema instance.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a Zod schema.
 */
function isZodType(value: unknown): value is ZodType {
    return (
        value !== null &&
        typeof value === 'object' &&
        '_def' in (value as object) &&
        'parse' in (value as object)
    )
}

/**
 * Creates a fully configured {@link Tool} with resolved JSON Schema metadata.
 *
 * This is the recommended way to define tools. It accepts either a Zod schema
 * or a plain JSON Schema for parameter validation, and eagerly resolves the
 * internal JSON Schema representation used when communicating with model providers.
 *
 * @typeParam TParams - The validated parameter type for the tool.
 * @typeParam TResult - The return type of the tool's execute function.
 * @param config - The tool configuration object.
 * @param config.name - A unique name identifying the tool.
 * @param config.description - A human-readable description of what the tool does.
 * @param config.parameters - A Zod schema or plain JSON Schema defining accepted parameters.
 * @param config.execute - The async function that performs the tool's work.
 * @returns A fully configured {@link Tool} instance ready to be passed to an agent.
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * import { defineTool } from '@agenti/core'
 *
 * const weatherTool = defineTool({
 *   name: 'get_weather',
 *   description: 'Get current weather for a city',
 *   parameters: z.object({ city: z.string() }),
 *   execute: async ({ city }) => {
 *     const data = await fetchWeather(city)
 *     return `${data.temp}°C, ${data.condition}`
 *   },
 * })
 * ```
 */
export function defineTool<TParams, TResult = unknown>(config: {
    name: string
    description: string
    parameters: ZodType<TParams> | JsonSchema
    execute: (
        params: TParams,
        context: {
            callId: string
            signal: AbortSignal
            messages: readonly import('./types').Message[]
        },
    ) => Promise<TResult>
}): Tool<TParams, TResult> {
    const tool: Tool<TParams, TResult> = {
        name: config.name,
        description: config.description,
        parameters: config.parameters,
        execute: config.execute as Tool<TParams, TResult>['execute'],
    }

    if (isZodType(config.parameters)) {
        tool._isZod = true
        const jsonSchema = zodToJsonSchema(config.parameters, { target: 'openAi' })
        /** Strip the `$schema` wrapper that zodToJsonSchema adds. */
        const { $schema, ...schema } = jsonSchema as Record<string, unknown>
        tool._jsonSchema = schema
    } else {
        tool._isZod = false
        tool._jsonSchema = config.parameters as Record<string, unknown>
    }

    return tool
}

/**
 * Converts a {@link Tool} into its JSON Schema wire format ({@link ToolJsonSchema})
 * suitable for sending to a model provider.
 *
 * If the tool's internal JSON Schema has not been resolved yet (i.e. the tool was
 * not created via {@link defineTool}), this function resolves it lazily.
 *
 * @param tool - The tool to convert.
 * @returns The tool's name, description, and parameters as a {@link ToolJsonSchema}.
 */
export function toolToJsonSchema(tool: Tool): ToolJsonSchema {
    if (!tool._jsonSchema) {
        /** Resolve lazily if defineTool was not used. */
        if (isZodType(tool.parameters)) {
            const jsonSchema = zodToJsonSchema(tool.parameters, { target: 'openAi' })
            const { $schema, ...schema } = jsonSchema as Record<string, unknown>
            tool._jsonSchema = schema
            tool._isZod = true
        } else {
            tool._jsonSchema = tool.parameters as Record<string, unknown>
            tool._isZod = false
        }
    }

    return {
        name: tool.name,
        description: tool.description,
        parameters: tool._jsonSchema,
    }
}

/**
 * Validates tool call arguments against the tool's parameter schema.
 *
 * When the tool uses a Zod schema, full parsing and validation is performed.
 * When the tool uses a plain JSON Schema, the arguments are returned as-is
 * (validation is assumed to be handled by the model or externally).
 *
 * @param tool - The tool whose schema to validate against.
 * @param args - The raw arguments from the model's tool call.
 * @returns The validated (and possibly transformed) arguments.
 * @throws {ZodError} If the tool uses a Zod schema and validation fails.
 */
export function validateToolArgs(tool: Tool, args: Record<string, unknown>): unknown {
    if (tool._isZod && isZodType(tool.parameters)) {
        return (tool.parameters as ZodType).parse(args)
    }
    return args
}
