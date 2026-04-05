import type { Message, ToolCall, ToolJsonSchema } from '@agentier/core'

/** Wire format for a Gemini conversation turn. */
export interface GeminiContent {
    role: 'user' | 'model'
    parts: GeminiPart[]
}

/**
 * A single part within a Gemini message.
 *
 * Can be plain text, a function call from the model, or a function response
 * from the caller.
 */
export type GeminiPart =
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { content: string } } }

/** Wire format for a Gemini function (tool) declaration. */
export interface GeminiFunctionDeclaration {
    name: string
    description: string
    parameters: Record<string, unknown>
}

/**
 * Converts agenti `Message` objects into Gemini `contents` and an optional `systemInstruction`.
 *
 * System messages become a top-level `systemInstruction`. Tool result messages
 * are placed inside `user` turns as `functionResponse` parts, and consecutive
 * tool results are merged into a single turn, matching the Gemini protocol.
 *
 * @param messages - Array of provider-agnostic messages.
 * @returns An object with optional `systemInstruction` and the `contents` array.
 */
export function toGeminiContents(messages: Message[]): {
    systemInstruction?: { parts: [{ text: string }] }
    contents: GeminiContent[]
} {
    let systemInstruction: { parts: [{ text: string }] } | undefined
    const contents: GeminiContent[] = []

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstruction = { parts: [{ text: msg.content ?? '' }] }
            continue
        }

        if (msg.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: msg.content ?? '' }] })
            continue
        }

        if (msg.role === 'assistant') {
            const parts: GeminiPart[] = []
            if (msg.content) {
                parts.push({ text: msg.content })
            }
            if (msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    parts.push({
                        functionCall: { name: tc.name, args: tc.arguments },
                    })
                }
            }
            if (parts.length > 0) {
                contents.push({ role: 'model', parts })
            }
            continue
        }

        if (msg.role === 'tool') {
            /** Gemini expects function responses inside user turns. */
            const part: GeminiPart = {
                functionResponse: {
                    name: msg.name ?? '',
                    response: { content: msg.content ?? '' },
                },
            }

            const last = contents[contents.length - 1]
            if (last && last.role === 'user' && last.parts.some((p) => 'functionResponse' in p)) {
                last.parts.push(part)
            } else {
                contents.push({ role: 'user', parts: [part] })
            }
        }
    }

    return { systemInstruction, contents }
}

/**
 * Converts agenti tool schemas into the Gemini function declarations format.
 *
 * Wraps all declarations in a single tool group, as required by the Gemini API.
 *
 * @param tools - Array of provider-agnostic tool JSON schemas.
 * @returns Array containing one tool group with all function declarations.
 */
export function toGeminiTools(
    tools: ToolJsonSchema[],
): { functionDeclarations: GeminiFunctionDeclaration[] }[] {
    return [
        {
            functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            })),
        },
    ]
}

/**
 * Extracts text and tool calls from a Gemini response candidates array.
 *
 * Since Gemini does not return tool call IDs, synthetic IDs are generated
 * using an incrementing counter (`call_0`, `call_1`, etc.).
 *
 * @param candidates - The `candidates` array from the Gemini API response.
 * @returns Parsed text (or `null` if empty) and an array of agenti `ToolCall` objects.
 */
export function fromGeminiResponse(candidates: Array<{ content: { parts: GeminiPart[] } }>): {
    text: string | null
    toolCalls: ToolCall[]
} {
    let text = ''
    const toolCalls: ToolCall[] = []
    let callIndex = 0

    const parts = candidates[0]?.content?.parts ?? []

    for (const part of parts) {
        if ('text' in part) {
            text += part.text
        } else if ('functionCall' in part) {
            toolCalls.push({
                id: `call_${callIndex++}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args,
            })
        }
    }

    return { text: text || null, toolCalls }
}
