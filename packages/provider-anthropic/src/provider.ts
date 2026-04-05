import type {
    ModelProvider,
    ChatParams,
    ModelResponse,
    StreamEvent,
    ToolCall,
} from '@agentier/core'
import type { AnthropicProviderConfig } from './types'
import {
    toAnthropicMessages,
    toAnthropicTools,
    fromAnthropicResponse,
    type AnthropicContentBlock,
} from './mapper'

/**
 * Creates an Anthropic {@link ModelProvider}.
 *
 * Supports both blocking `chat` and streaming `stream` completions via the
 * Anthropic Messages API (`/v1/messages`). Handles the Anthropic-specific
 * SSE event protocol (`content_block_start`, `content_block_delta`, etc.).
 *
 * @param config - Provider configuration including API key and optional overrides.
 * @returns A `ModelProvider` wired to the Anthropic Messages API.
 *
 * @example
 * ```ts
 * import { anthropic } from '@agentier/provider-anthropic'
 *
 * const provider = anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
 * const response = await provider.chat({
 *   model: 'claude-sonnet-4-20250514',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })
 * ```
 */
export function anthropic(config: AnthropicProviderConfig): ModelProvider {
    const baseUrl = (config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')
    const apiVersion = config.apiVersion ?? '2023-06-01'
    const fetchFn = config.fetch ?? globalThis.fetch

    /**
     * Builds the HTTP headers for an Anthropic API request.
     * @internal
     */
    function buildHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': apiVersion,
            ...config.defaultHeaders,
        }
    }

    /**
     * Builds the JSON request body from chat parameters.
     * @internal
     */
    function buildBody(params: ChatParams, stream = false) {
        const { system, messages } = toAnthropicMessages(params.messages)

        const body: Record<string, unknown> = {
            model: params.model,
            messages,
            max_tokens: params.maxOutputTokens ?? 4096,
            stream,
        }

        if (system) body.system = system
        if (params.tools && params.tools.length > 0) {
            body.tools = toAnthropicTools(params.tools)
        }
        if (params.temperature !== undefined) body.temperature = params.temperature
        if (params.topP !== undefined) body.top_p = params.topP

        return body
    }

    const provider: ModelProvider = {
        name: 'anthropic',

        async chat(params: ChatParams): Promise<ModelResponse> {
            const response = await fetchFn(`${baseUrl}/v1/messages`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(buildBody(params, false)),
                signal: params.signal,
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Anthropic API error (${response.status}): ${errorBody}`)
            }

            const data = await response.json()
            const { text, toolCalls } = fromAnthropicResponse(data.content)

            return {
                content: text,
                toolCalls,
                usage: {
                    inputTokens: data.usage?.input_tokens ?? 0,
                    outputTokens: data.usage?.output_tokens ?? 0,
                },
                raw: data,
            }
        },

        async *stream(params: ChatParams): AsyncIterable<StreamEvent> {
            const response = await fetchFn(`${baseUrl}/v1/messages`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(buildBody(params, true)),
                signal: params.signal,
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Anthropic API error (${response.status}): ${errorBody}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''
            const toolCalls: ToolCall[] = []
            let currentToolUse: { id: string; name: string; inputJson: string } | null = null
            let inputTokens = 0
            let outputTokens = 0

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() ?? ''

                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed.startsWith('data: ')) continue
                        const data = trimmed.slice(6)

                        try {
                            const event = JSON.parse(data)

                            switch (event.type) {
                                case 'content_block_start': {
                                    const block = event.content_block
                                    if (block.type === 'tool_use') {
                                        currentToolUse = {
                                            id: block.id,
                                            name: block.name,
                                            inputJson: '',
                                        }
                                        yield {
                                            type: 'tool_call_start',
                                            id: block.id,
                                            name: block.name,
                                        }
                                    }
                                    break
                                }

                                case 'content_block_delta': {
                                    const delta = event.delta
                                    if (delta.type === 'text_delta') {
                                        fullContent += delta.text
                                        yield { type: 'token', text: delta.text }
                                    } else if (
                                        delta.type === 'input_json_delta' &&
                                        currentToolUse
                                    ) {
                                        currentToolUse.inputJson += delta.partial_json
                                        yield {
                                            type: 'tool_call_delta',
                                            id: currentToolUse.id,
                                            argumentsDelta: delta.partial_json,
                                        }
                                    }
                                    break
                                }

                                case 'content_block_stop': {
                                    if (currentToolUse) {
                                        const call: ToolCall = {
                                            id: currentToolUse.id,
                                            name: currentToolUse.name,
                                            arguments: currentToolUse.inputJson
                                                ? JSON.parse(currentToolUse.inputJson)
                                                : {},
                                        }
                                        toolCalls.push(call)
                                        yield { type: 'tool_call_end', id: currentToolUse.id, call }
                                        currentToolUse = null
                                    }
                                    break
                                }

                                case 'message_delta': {
                                    if (event.usage) {
                                        outputTokens = event.usage.output_tokens ?? outputTokens
                                    }
                                    break
                                }

                                case 'message_start': {
                                    if (event.message?.usage) {
                                        inputTokens = event.message.usage.input_tokens ?? 0
                                    }
                                    break
                                }
                            }
                        } catch {
                            // Skip malformed JSON chunks
                        }
                    }
                }
            } finally {
                reader.releaseLock()
            }

            yield {
                type: 'done',
                response: {
                    content: fullContent || null,
                    toolCalls,
                    usage: { inputTokens, outputTokens },
                },
            }
        },
    }

    return provider
}
