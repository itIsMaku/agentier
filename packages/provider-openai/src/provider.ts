import type {
    ModelProvider,
    ChatParams,
    ModelResponse,
    StreamEvent,
    ToolCall,
} from '@agentier/core'
import type { OpenAIProviderConfig } from './types'
import { toOpenAIMessages, toOpenAITools, fromOpenAIToolCalls } from './mapper'

/**
 * Creates an OpenAI-compatible {@link ModelProvider}.
 *
 * Supports both blocking `chat` and streaming `stream` completions via the
 * `/chat/completions` endpoint. Works with any OpenAI-compatible API by
 * overriding `baseUrl` in the config.
 *
 * @param config - Provider configuration including API key and optional overrides.
 * @returns A `ModelProvider` wired to the OpenAI chat completions API.
 *
 * @example
 * ```ts
 * import { openai } from '@agentier/provider-openai'
 *
 * const provider = openai({ apiKey: process.env.OPENAI_API_KEY! })
 * const response = await provider.chat({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })
 * ```
 */
export function openai(config: OpenAIProviderConfig): ModelProvider {
    const baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')
    const fetchFn = config.fetch ?? globalThis.fetch

    /**
     * Builds the HTTP headers for an OpenAI API request.
     * @internal
     */
    function buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            ...config.defaultHeaders,
        }
        if (config.organization) {
            headers['OpenAI-Organization'] = config.organization
        }
        return headers
    }

    /**
     * Builds the JSON request body from chat parameters.
     * @internal
     */
    function buildBody(params: ChatParams, stream = false) {
        const body: Record<string, unknown> = {
            model: params.model,
            messages: toOpenAIMessages(params.messages),
            stream,
        }

        if (params.tools && params.tools.length > 0) {
            body.tools = toOpenAITools(params.tools)
        }

        if (params.temperature !== undefined) body.temperature = params.temperature
        if (params.topP !== undefined) body.top_p = params.topP
        if (params.maxOutputTokens !== undefined) body.max_tokens = params.maxOutputTokens

        if (params.responseFormat) {
            body.response_format = params.responseFormat
        }

        return body
    }

    const provider: ModelProvider = {
        name: 'openai',

        async chat(params: ChatParams): Promise<ModelResponse> {
            const response = await fetchFn(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(buildBody(params, false)),
                signal: params.signal,
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`OpenAI API error (${response.status}): ${errorBody}`)
            }

            const data = await response.json()
            const choice = data.choices[0]

            return {
                content: choice.message.content,
                toolCalls: fromOpenAIToolCalls(choice.message.tool_calls),
                usage: {
                    inputTokens: data.usage?.prompt_tokens ?? 0,
                    outputTokens: data.usage?.completion_tokens ?? 0,
                },
                raw: data,
            }
        },

        async *stream(params: ChatParams): AsyncIterable<StreamEvent> {
            const response = await fetchFn(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(buildBody(params, true)),
                signal: params.signal,
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`OpenAI API error (${response.status}): ${errorBody}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''
            const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>()
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
                        if (!trimmed || !trimmed.startsWith('data: ')) continue
                        const data = trimmed.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)
                            const delta = parsed.choices?.[0]?.delta

                            if (!delta) continue

                            /** Emit text token deltas as they arrive. */
                            if (delta.content) {
                                fullContent += delta.content
                                yield { type: 'token', text: delta.content }
                            }

                            /** Accumulate streamed tool call fragments by index. */
                            if (delta.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    const idx = tc.index ?? 0

                                    if (tc.id) {
                                        toolCallBuffers.set(idx, {
                                            id: tc.id,
                                            name: tc.function?.name ?? '',
                                            args: tc.function?.arguments ?? '',
                                        })
                                        yield {
                                            type: 'tool_call_start',
                                            id: tc.id,
                                            name: tc.function?.name ?? '',
                                        }
                                    } else {
                                        const existing = toolCallBuffers.get(idx)
                                        if (existing && tc.function?.arguments) {
                                            existing.args += tc.function.arguments
                                            yield {
                                                type: 'tool_call_delta',
                                                id: existing.id,
                                                argumentsDelta: tc.function.arguments,
                                            }
                                        }
                                    }
                                }
                            }

                            /** Track usage when the provider includes it in the stream. */
                            if (parsed.usage) {
                                inputTokens = parsed.usage.prompt_tokens ?? inputTokens
                                outputTokens = parsed.usage.completion_tokens ?? outputTokens
                            }
                        } catch {
                            // Skip malformed JSON chunks
                        }
                    }
                }
            } finally {
                reader.releaseLock()
            }

            /** Finalize all buffered tool calls and emit end events. */
            const toolCalls: ToolCall[] = []
            for (const [, tc] of toolCallBuffers) {
                const call: ToolCall = {
                    id: tc.id,
                    name: tc.name,
                    arguments: tc.args ? JSON.parse(tc.args) : {},
                }
                toolCalls.push(call)
                yield { type: 'tool_call_end', id: tc.id, call }
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
