import type { Message, ToolCall, ToolJsonSchema } from '@agentier/core'

/** A content part in an OpenAI message (text or image). */
export type OpenAIContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }

/** Wire format for an OpenAI chat message. */
export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string | OpenAIContentPart[] | null
    tool_calls?: OpenAIToolCall[]
    tool_call_id?: string
    name?: string
}

/** Wire format for an OpenAI tool call within an assistant message. */
export interface OpenAIToolCall {
    id: string
    type: 'function'
    function: {
        name: string
        /** JSON-encoded arguments string. */
        arguments: string
    }
}

/** Wire format for an OpenAI tool (function) definition. */
export interface OpenAITool {
    type: 'function'
    function: {
        name: string
        description: string
        parameters: Record<string, unknown>
    }
}

/**
 * Converts agenti `Message` objects into the OpenAI chat completions message format.
 *
 * Handles tool calls, tool call IDs, and optional message names.
 *
 * @param messages - Array of provider-agnostic messages.
 * @returns Array of OpenAI-formatted messages ready for the API.
 */
export function toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map((msg) => {
        const oaiMsg: OpenAIMessage = {
            role: msg.role,
            content: msg.content,
        }

        /** Tool result with image → multimodal content array. */
        if (msg.role === 'tool' && msg.image) {
            const parts: OpenAIContentPart[] = []
            if (msg.content) {
                parts.push({ type: 'text', text: msg.content })
            }
            parts.push({
                type: 'image_url',
                image_url: { url: `data:${msg.image.mediaType};base64,${msg.image.data}` },
            })
            oaiMsg.content = parts
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
            oaiMsg.tool_calls = msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments),
                },
            }))
        }

        if (msg.toolCallId) {
            oaiMsg.tool_call_id = msg.toolCallId
        }

        if (msg.name) {
            oaiMsg.name = msg.name
        }

        return oaiMsg
    })
}

/**
 * Converts agenti tool schemas into the OpenAI function-calling tool format.
 *
 * @param tools - Array of provider-agnostic tool JSON schemas.
 * @returns Array of OpenAI tool definitions.
 */
export function toOpenAITools(tools: ToolJsonSchema[]): OpenAITool[] {
    return tools.map((t) => ({
        type: 'function' as const,
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }))
}

/**
 * Converts OpenAI tool calls from a response back into agenti `ToolCall` objects.
 *
 * Parses the JSON-encoded `arguments` string in each tool call.
 *
 * @param toolCalls - Optional array of OpenAI tool calls from the API response.
 * @returns Array of agenti tool calls, or an empty array if none were provided.
 */
export function fromOpenAIToolCalls(toolCalls?: OpenAIToolCall[]): ToolCall[] {
    if (!toolCalls) return []
    return toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
    }))
}
