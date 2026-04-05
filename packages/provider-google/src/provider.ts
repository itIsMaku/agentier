import type {
    ModelProvider,
    ChatParams,
    ModelResponse,
    StreamEvent,
    ToolCall,
} from '@agentier/core'
import type { GoogleProviderConfig } from './types'
import { toGeminiContents, toGeminiTools, fromGeminiResponse, type GeminiPart } from './mapper'

/**
 * Creates a Google Gemini {@link ModelProvider}.
 *
 * Supports both blocking `chat` (via `generateContent`) and streaming `stream`
 * (via `streamGenerateContent`) endpoints. The API key is passed as a query
 * parameter rather than a header, matching the Gemini REST convention.
 *
 * @param config - Provider configuration including API key and optional overrides.
 * @returns A `ModelProvider` wired to the Google Gemini API.
 *
 * @example
 * ```ts
 * import { google } from '@agentier/provider-google'
 *
 * const provider = google({ apiKey: process.env.GOOGLE_API_KEY! })
 * const response = await provider.chat({
 *   model: 'gemini-2.0-flash',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })
 * ```
 */
export function google(config: GoogleProviderConfig): ModelProvider {
    const apiVersion = config.apiVersion ?? 'v1beta'
    const baseUrl = (
        config.baseUrl ?? `https://generativelanguage.googleapis.com/${apiVersion}`
    ).replace(/\/$/, '')
    const fetchFn = config.fetch ?? globalThis.fetch

    /**
     * Builds the HTTP headers for a Gemini API request.
     * @internal
     */
    function buildHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            ...config.defaultHeaders,
        }
    }

    /**
     * Builds the JSON request body from chat parameters.
     * @internal
     */
    function buildBody(params: ChatParams) {
        const { systemInstruction, contents } = toGeminiContents(params.messages)

        const body: Record<string, unknown> = {
            contents,
        }

        if (systemInstruction) body.systemInstruction = systemInstruction

        if (params.tools && params.tools.length > 0) {
            body.tools = toGeminiTools(params.tools)
        }

        const generationConfig: Record<string, unknown> = {}
        if (params.temperature !== undefined) generationConfig.temperature = params.temperature
        if (params.topP !== undefined) generationConfig.topP = params.topP
        if (params.maxOutputTokens !== undefined)
            generationConfig.maxOutputTokens = params.maxOutputTokens

        if (Object.keys(generationConfig).length > 0) {
            body.generationConfig = generationConfig
        }

        return body
    }

    const provider: ModelProvider = {
        name: 'google',

        async chat(params: ChatParams): Promise<ModelResponse> {
            const url = `${baseUrl}/models/${params.model}:generateContent?key=${config.apiKey}`

            const response = await fetchFn(url, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(buildBody(params)),
                signal: params.signal,
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Google API error (${response.status}): ${errorBody}`)
            }

            const data = await response.json()
            const { text, toolCalls } = fromGeminiResponse(data.candidates ?? [])

            return {
                content: text,
                toolCalls,
                usage: {
                    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
                    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
                },
                raw: data,
            }
        },

        async *stream(params: ChatParams): AsyncIterable<StreamEvent> {
            const url = `${baseUrl}/models/${params.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`

            const response = await fetchFn(url, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(buildBody(params)),
                signal: params.signal,
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw new Error(`Google API error (${response.status}): ${errorBody}`)
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''
            const toolCalls: ToolCall[] = []
            let callIndex = 0
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
                            const parsed = JSON.parse(data)
                            const parts: GeminiPart[] = parsed.candidates?.[0]?.content?.parts ?? []

                            for (const part of parts) {
                                if ('text' in part) {
                                    fullContent += part.text
                                    yield { type: 'token', text: part.text }
                                } else if ('functionCall' in part) {
                                    /** Gemini delivers complete function calls in a single chunk. */
                                    const id = `call_${callIndex++}`
                                    const call: ToolCall = {
                                        id,
                                        name: part.functionCall.name,
                                        arguments: part.functionCall.args,
                                    }
                                    toolCalls.push(call)
                                    yield {
                                        type: 'tool_call_start',
                                        id,
                                        name: part.functionCall.name,
                                    }
                                    yield { type: 'tool_call_end', id, call }
                                }
                            }

                            if (parsed.usageMetadata) {
                                inputTokens = parsed.usageMetadata.promptTokenCount ?? inputTokens
                                outputTokens =
                                    parsed.usageMetadata.candidatesTokenCount ?? outputTokens
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
