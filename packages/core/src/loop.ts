import type {
    Message,
    AgentConfig,
    AgentResult,
    RunOptions,
    ExecutedToolCall,
    UsageStats,
    Tool,
    ModelResponse,
    AgentAction,
    ToolJsonSchema,
} from './types'
import { AgentError } from './errors'
import { toolToJsonSchema, validateToolArgs } from './tool'
import { createAction, runMiddlewareChain } from './middleware'

/**
 * @internal
 * Serializes a tool's return value into a string suitable for inclusion in a
 * conversation message. Returns a default success message for `null`/`undefined`,
 * passes strings through directly, and JSON-stringifies everything else.
 *
 * @param value - The raw return value from a tool execution.
 * @returns A string representation of the result.
 */
function serializeToolResult(value: unknown): string {
    if (value === undefined || value === null) return 'Tool executed successfully'
    if (typeof value === 'string') return value
    return JSON.stringify(value)
}

/**
 * Executes the core agent reasoning loop: repeatedly calls the model, executes
 * any requested tools, appends results to the conversation, and repeats until
 * the model responds without tool calls or a termination condition is met.
 *
 * This is the main engine behind {@link Agent.run}. It handles:
 * - Building the initial message history (from memory, options, or scratch)
 * - System prompt injection (with optional structured output instructions)
 * - Model calls (streaming or non-streaming)
 * - Parallel tool execution with validation
 * - Middleware dispatch for all actions
 * - Token budgeting, iteration limits, and timeouts
 * - Structured output parsing with retry
 * - Memory persistence
 *
 * @typeParam T - The expected output type. Defaults to `string`.
 * @param config - The agent configuration.
 * @param prompt - The user prompt to process.
 * @param options - Optional per-run overrides and callbacks.
 * @returns A promise resolving to the complete {@link AgentResult}.
 * @throws {AgentError} When a model call fails, output parsing fails, or other unrecoverable errors occur.
 */
export async function runAgentLoop<T = string>(
    config: AgentConfig,
    prompt: string,
    options: RunOptions<T> = {},
): Promise<AgentResult<T>> {
    const startTime = Date.now()

    const maxIterations = options.maxIterations ?? config.maxIterations ?? 10
    const maxTokens = options.maxTokens ?? config.maxTokens ?? Infinity
    const timeout = options.timeout ?? config.timeout ?? 60_000
    const middlewares = config.middleware ?? []

    /** Abort controller that combines the external signal and the timeout. */
    const controller = new AbortController()
    const { signal } = controller

    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort())
    }

    const timeoutId = setTimeout(() => controller.abort(), timeout)

    /** Build the initial message history. */
    let messages: Message[] = []

    if (config.memory && !options.messages) {
        const sessionId = options.sessionId ?? 'default'
        messages = await config.memory.load(sessionId)
    } else if (options.messages) {
        messages = [...options.messages]
    }

    /** Prepend system prompt if not already present. */
    if (config.systemPrompt && !messages.some((m) => m.role === 'system')) {
        let systemContent = config.systemPrompt
        if (options.outputSchema) {
            systemContent +=
                '\n\nYou MUST respond with valid JSON matching this schema. Output ONLY the JSON, no other text.\nSchema: ' +
                JSON.stringify(options.outputSchema)
        }
        messages.unshift({ role: 'system', content: systemContent })
    }

    messages.push({ role: 'user', content: prompt })

    /** Build the tool registry and JSON schemas. */
    const tools: Tool[] = config.tools ?? []
    const toolMap = new Map(tools.map((t) => [t.name, t]))
    const toolSchemas: ToolJsonSchema[] = tools.map(toolToJsonSchema)

    /** Accumulated usage statistics. */
    const usage: UsageStats = {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        iterations: 0,
    }
    const executedToolCalls: ExecutedToolCall[] = []

    /** Emit the loop_start action through middleware. */
    await runMiddlewareChain(
        middlewares,
        createAction('loop_start', { prompt, config }),
        async () => createAction('loop_start', { prompt, config }),
    )

    let lastAssistantContent: string | null = null

    try {
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            usage.iterations = iteration + 1

            if (signal.aborted) {
                await emitLoopEnd(middlewares, buildResult(), 'aborted')
                break
            }

            if (usage.totalTokens >= maxTokens) {
                await emitLoopEnd(middlewares, buildResult(), 'max_tokens')
                break
            }

            /** Determine whether to stream based on the presence of an onToken callback. */
            const useStream = !!options.onToken
            let response: ModelResponse

            const modelCallAction = createAction('model_call', {
                messages: [...messages],
                tools: toolSchemas,
                model: config.model,
            })

            try {
                const resultAction = await runMiddlewareChain(
                    middlewares,
                    modelCallAction,
                    async () => {
                        let resp: ModelResponse

                        if (useStream) {
                            resp = await streamModelCall(
                                config,
                                messages,
                                toolSchemas,
                                options,
                                signal,
                            )
                        } else {
                            resp = await config.provider.chat({
                                model: config.model,
                                messages,
                                tools: toolSchemas.length > 0 ? toolSchemas : undefined,
                                temperature: options.temperature ?? config.temperature,
                                topP: config.topP,
                                maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
                                signal,
                            })
                        }

                        return createAction('model_response', {
                            response: resp,
                            usage: resp.usage,
                        })
                    },
                )

                response = (resultAction.payload as { response: ModelResponse }).response
                const respUsage = (
                    resultAction.payload as { usage: { inputTokens: number; outputTokens: number } }
                ).usage

                usage.inputTokens += respUsage.inputTokens
                usage.outputTokens += respUsage.outputTokens
                usage.totalTokens = usage.inputTokens + usage.outputTokens
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err))
                await runMiddlewareChain(
                    middlewares,
                    createAction('error', { source: 'model', error, retryable: true }),
                    async () => {
                        throw new AgentError(
                            'Model call failed: ' + error.message,
                            'MODEL_ERROR',
                            error,
                        )
                    },
                )
                throw new AgentError('Model call failed: ' + error.message, 'MODEL_ERROR', error)
            }

            /** Append the assistant's response to the conversation. */
            const assistantMsg: Message = {
                role: 'assistant',
                content: response.content,
            }
            if (response.toolCalls.length > 0) {
                assistantMsg.toolCalls = response.toolCalls
            }
            messages.push(assistantMsg)
            lastAssistantContent = response.content

            /** If the model did not request any tool calls, the loop is complete. */
            if (response.toolCalls.length === 0) {
                await emitLoopEnd(middlewares, buildResult(), 'complete')
                break
            }

            /** Execute all requested tool calls in parallel. */
            const toolPromises = response.toolCalls.map(async (tc) => {
                const tool = toolMap.get(tc.name)

                await runMiddlewareChain(
                    middlewares,
                    createAction('tool_call', {
                        id: tc.id,
                        name: tc.name,
                        arguments: tc.arguments,
                    }),
                    async () =>
                        createAction('tool_call', {
                            id: tc.id,
                            name: tc.name,
                            arguments: tc.arguments,
                        }),
                )

                if (options.onToolCall) {
                    options.onToolCall(tc.name, tc.arguments)
                }

                if (!tool) {
                    const errorMsg = `Tool "${tc.name}" not found`
                    messages.push({
                        role: 'tool',
                        content: `Error: ${errorMsg}`,
                        toolCallId: tc.id,
                    })
                    return
                }

                const toolStart = Date.now()

                try {
                    const validatedArgs = validateToolArgs(tool, tc.arguments)
                    const result = await tool.execute(validatedArgs as never, {
                        callId: tc.id,
                        signal,
                        messages: [...messages],
                    })

                    const duration = Date.now() - toolStart
                    const serialized = serializeToolResult(result)

                    await runMiddlewareChain(
                        middlewares,
                        createAction('tool_result', { id: tc.id, name: tc.name, result, duration }),
                        async () =>
                            createAction('tool_result', {
                                id: tc.id,
                                name: tc.name,
                                result,
                                duration,
                            }),
                    )

                    if (options.onToolResult) {
                        options.onToolResult(tc.name, result)
                    }

                    executedToolCalls.push({
                        id: tc.id,
                        name: tc.name,
                        arguments: tc.arguments,
                        result,
                        duration,
                    })

                    messages.push({ role: 'tool', content: serialized, toolCallId: tc.id })
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err))
                    const duration = Date.now() - toolStart

                    await runMiddlewareChain(
                        middlewares,
                        createAction('error', {
                            source: 'tool',
                            error,
                            name: tc.name,
                            retryable: false,
                        }),
                        async () =>
                            createAction('error', {
                                source: 'tool',
                                error,
                                name: tc.name,
                                retryable: false,
                            }),
                    )

                    executedToolCalls.push({
                        id: tc.id,
                        name: tc.name,
                        arguments: tc.arguments,
                        result: `Error: ${error.message}`,
                        duration,
                    })

                    messages.push({
                        role: 'tool',
                        content: `Error: ${error.message}`,
                        toolCallId: tc.id,
                    })
                }
            })

            await Promise.all(toolPromises)

            if (iteration === maxIterations - 1) {
                await emitLoopEnd(middlewares, buildResult(), 'max_iterations')
            }
        }
    } finally {
        clearTimeout(timeoutId)
    }

    const result = buildResult()

    if (options.outputSchema) {
        return await parseStructuredOutput(result, options, config, messages, middlewares)
    }

    /** Persist conversation to memory if configured. */
    if (config.memory && !options.skipMemorySave) {
        const sessionId = options.sessionId ?? 'default'
        await config.memory.save(sessionId, messages)
    }

    if (options.onComplete) {
        options.onComplete(result)
    }

    return result

    /**
     * @internal
     * Builds an {@link AgentResult} snapshot from the current loop state.
     *
     * @returns The current result including output, messages, tool calls, usage, and duration.
     */
    function buildResult(): AgentResult<T> {
        const output = (lastAssistantContent ?? '') as T
        return {
            output,
            messages: [...messages],
            toolCalls: [...executedToolCalls],
            usage: { ...usage },
            duration: Date.now() - startTime,
        }
    }

    /**
     * @internal
     * Emits a `loop_end` action through the middleware chain.
     *
     * @param mws - The middleware array to dispatch through.
     * @param result - The agent result at the time the loop ended.
     * @param reason - The reason the loop is ending.
     */
    async function emitLoopEnd(
        mws: typeof middlewares,
        result: AgentResult<T>,
        reason: 'complete' | 'max_iterations' | 'max_tokens' | 'timeout' | 'aborted',
    ) {
        await runMiddlewareChain(
            mws,
            createAction('loop_end', { result: result as AgentResult, reason }),
            async () => createAction('loop_end', { result: result as AgentResult, reason }),
        )
    }
}

/**
 * @internal
 * Performs a streaming model call, forwarding tokens to the `onToken` callback
 * and collecting the final response.
 *
 * @typeParam T - The run's output type (passed through for type consistency).
 * @param config - The agent configuration.
 * @param messages - The current conversation messages.
 * @param toolSchemas - The tool JSON schemas to send to the model.
 * @param options - The run options containing the `onToken` callback.
 * @param signal - The abort signal for cancellation.
 * @returns A promise resolving to the complete {@link ModelResponse}.
 * @throws {AgentError} If the stream ends without emitting a `done` event.
 */
async function streamModelCall<T>(
    config: AgentConfig,
    messages: Message[],
    toolSchemas: ToolJsonSchema[],
    options: RunOptions<T>,
    signal: AbortSignal,
): Promise<ModelResponse> {
    const stream = config.provider.stream({
        model: config.model,
        messages,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        temperature: options.temperature ?? config.temperature,
        topP: config.topP,
        maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
        signal,
    })

    let finalResponse: ModelResponse | null = null

    for await (const event of stream) {
        switch (event.type) {
            case 'token':
                if (options.onToken) options.onToken(event.text)
                break
            case 'done':
                finalResponse = event.response
                break
            case 'error':
                throw event.error
        }
    }

    if (!finalResponse) {
        throw new AgentError('Stream ended without done event', 'PROVIDER_ERROR')
    }

    return finalResponse
}

/**
 * @internal
 * Attempts to parse the agent's output as structured data using the provided
 * Zod schema. If parsing fails, retries up to `maxRetries` times by asking
 * the model to correct its output.
 *
 * @typeParam T - The expected structured output type.
 * @param result - The current agent result whose output will be parsed.
 * @param options - The run options containing the `outputSchema`.
 * @param config - The agent configuration (used for retry model calls).
 * @param messages - The mutable message history (retry prompts are appended).
 * @param middlewares - The middleware chain (unused in retries but kept for consistency).
 * @returns A promise resolving to the agent result with the parsed and validated output.
 * @throws {AgentError} With code `'OUTPUT_PARSE_ERROR'` if all parse attempts fail.
 */
async function parseStructuredOutput<T>(
    result: AgentResult<T>,
    options: RunOptions<T>,
    config: AgentConfig,
    messages: Message[],
    middlewares: AgentConfig['middleware'],
): Promise<AgentResult<T>> {
    const maxRetries = 2
    let lastError: Error | null = null
    let content = result.output as unknown as string

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            let jsonStr = content
            /** Handle markdown code blocks wrapping the JSON output. */
            const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim()
            }

            const parsed = JSON.parse(jsonStr)
            const validated = options.outputSchema!.parse(parsed)

            return {
                ...result,
                output: validated as T,
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))

            if (attempt < maxRetries) {
                /** Ask the model to fix its malformed output. */
                messages.push({
                    role: 'user',
                    content: `Your response was not valid JSON matching the required schema. Error: ${lastError.message}\n\nPlease respond with ONLY valid JSON matching the schema. No other text.`,
                })

                const response = await config.provider.chat({
                    model: config.model,
                    messages,
                    temperature: 0,
                    maxOutputTokens: options.maxOutputTokens ?? config.maxOutputTokens,
                })

                messages.push({ role: 'assistant', content: response.content })
                content = response.content ?? ''
            }
        }
    }

    throw new AgentError(
        `Failed to parse structured output after ${maxRetries + 1} attempts: ${lastError?.message}`,
        'OUTPUT_PARSE_ERROR',
        lastError ?? undefined,
    )
}
