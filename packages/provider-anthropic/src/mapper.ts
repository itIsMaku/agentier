import type { Message, ToolCall, ToolJsonSchema } from '@agentier/core'

/** Valid roles in the Anthropic Messages API (system is handled separately). */
export type AnthropicRole = 'user' | 'assistant'

/** A plain text content block. */
export interface AnthropicTextBlock {
    type: 'text'
    text: string
}

/** A tool-use content block representing an assistant's request to invoke a tool. */
export interface AnthropicToolUseBlock {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
}

/** An image content block within a tool result. */
export interface AnthropicImageBlock {
    type: 'image'
    source: {
        type: 'base64'
        media_type: string
        data: string
    }
}

/** Content inside a tool result — can be text or image blocks. */
export type AnthropicToolResultContent = AnthropicTextBlock | AnthropicImageBlock

/** A tool-result content block carrying the output of a previously invoked tool. */
export interface AnthropicToolResultBlock {
    type: 'tool_result'
    tool_use_id: string
    content: string | AnthropicToolResultContent[]
}

/** Union of all content block types used in Anthropic messages. */
export type AnthropicContentBlock =
    | AnthropicTextBlock
    | AnthropicToolUseBlock
    | AnthropicToolResultBlock

/** Wire format for an Anthropic message (role + mixed content blocks). */
export interface AnthropicMessage {
    role: AnthropicRole
    content: string | AnthropicContentBlock[]
}

/** Wire format for an Anthropic tool definition. */
export interface AnthropicTool {
    name: string
    description: string
    input_schema: Record<string, unknown>
}

/**
 * Converts agenti `Message` objects into the Anthropic Messages API format.
 *
 * System messages are extracted into a separate `system` string (Anthropic
 * treats system prompts as a top-level parameter, not a message). Tool result
 * messages are folded into the preceding `user` turn when possible, matching
 * the Anthropic expectation that tool results appear inside user messages.
 *
 * @param messages - Array of provider-agnostic messages.
 * @returns An object with an optional `system` prompt and an array of Anthropic messages.
 */
export function toAnthropicMessages(messages: Message[]): {
    system?: string
    messages: AnthropicMessage[]
} {
    let system: string | undefined
    const result: AnthropicMessage[] = []

    for (const msg of messages) {
        if (msg.role === 'system') {
            system = msg.content ?? undefined
            continue
        }

        if (msg.role === 'user') {
            result.push({ role: 'user', content: msg.content ?? '' })
            continue
        }

        if (msg.role === 'assistant') {
            const content: AnthropicContentBlock[] = []

            if (msg.content) {
                content.push({ type: 'text', text: msg.content })
            }

            if (msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    content.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.name,
                        input: tc.arguments,
                    })
                }
            }

            result.push({
                role: 'assistant',
                content:
                    content.length === 1 && content[0].type === 'text' ? content[0].text : content,
            })
            continue
        }

        if (msg.role === 'tool') {
            /** Anthropic expects tool results inside user messages. */
            const lastMsg = result[result.length - 1]

            let toolContent: string | AnthropicToolResultContent[]
            if (msg.image) {
                const parts: AnthropicToolResultContent[] = []
                if (msg.content) {
                    parts.push({ type: 'text', text: msg.content })
                }
                parts.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: msg.image.mediaType,
                        data: msg.image.data,
                    },
                })
                toolContent = parts
            } else {
                toolContent = msg.content ?? ''
            }

            const toolResultBlock: AnthropicToolResultBlock = {
                type: 'tool_result',
                tool_use_id: msg.toolCallId ?? '',
                content: toolContent,
            }

            if (lastMsg && lastMsg.role === 'user' && Array.isArray(lastMsg.content)) {
                lastMsg.content.push(toolResultBlock)
            } else {
                result.push({ role: 'user', content: [toolResultBlock] })
            }
        }
    }

    return { system, messages: result }
}

/**
 * Converts agenti tool schemas into the Anthropic tool definition format.
 *
 * @param tools - Array of provider-agnostic tool JSON schemas.
 * @returns Array of Anthropic tool definitions with `input_schema`.
 */
export function toAnthropicTools(tools: ToolJsonSchema[]): AnthropicTool[] {
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
    }))
}

/**
 * Extracts text and tool calls from Anthropic response content blocks.
 *
 * @param content - Array of content blocks from the Anthropic API response.
 * @returns Parsed text (or `null` if empty) and an array of agenti `ToolCall` objects.
 */
export function fromAnthropicResponse(content: AnthropicContentBlock[]): {
    text: string | null
    toolCalls: ToolCall[]
} {
    let text = ''
    const toolCalls: ToolCall[] = []

    for (const block of content) {
        if (block.type === 'text') {
            text += block.text
        } else if (block.type === 'tool_use') {
            toolCalls.push({
                id: block.id,
                name: block.name,
                arguments: block.input,
            })
        }
    }

    return {
        text: text || null,
        toolCalls,
    }
}
