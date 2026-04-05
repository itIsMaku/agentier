import { describe, it, expect } from 'bun:test'
import { z } from 'zod'
import { createAgent } from '../src/agent'
import { defineTool } from '../src/tool'
import type { ModelProvider, ChatParams, ModelResponse, StreamEvent } from '../src/types'

// Mock provider that returns predefined responses
function createMockProvider(responses: ModelResponse[]): ModelProvider {
    let callIndex = 0

    return {
        name: 'mock',
        async chat(_params: ChatParams): Promise<ModelResponse> {
            const response = responses[callIndex++]
            if (!response) throw new Error('No more mock responses')
            return response
        },
        async *stream(_params: ChatParams): AsyncIterable<StreamEvent> {
            const response = responses[callIndex++]
            if (!response) throw new Error('No more mock responses')

            if (response.content) {
                for (const char of response.content) {
                    yield { type: 'token', text: char }
                }
            }
            yield { type: 'done', response }
        },
    }
}

describe('createAgent', () => {
    it('should create an agent and run simple prompt', async () => {
        const provider = createMockProvider([
            { content: 'Hello!', toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } },
        ])

        const agent = createAgent({
            provider,
            model: 'test-model',
            systemPrompt: 'You are helpful.',
        })

        const result = await agent.run('Hi')

        expect(result.output).toBe('Hello!')
        expect(result.messages).toHaveLength(3) // system + user + assistant
        expect(result.usage.iterations).toBe(1)
        expect(result.usage.inputTokens).toBe(10)
        expect(result.usage.outputTokens).toBe(5)
        expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('should handle tool calls', async () => {
        const provider = createMockProvider([
            {
                content: null,
                toolCalls: [{ id: 'call_1', name: 'get_weather', arguments: { city: 'Prague' } }],
                usage: { inputTokens: 20, outputTokens: 10 },
            },
            {
                content: 'The weather in Prague is sunny, 22°C.',
                toolCalls: [],
                usage: { inputTokens: 30, outputTokens: 15 },
            },
        ])

        const weatherTool = defineTool({
            name: 'get_weather',
            description: 'Get weather',
            parameters: z.object({ city: z.string() }),
            execute: async ({ city }) => ({ city, temp: 22, condition: 'sunny' }),
        })

        const agent = createAgent({
            provider,
            model: 'test-model',
            tools: [weatherTool],
        })

        const result = await agent.run('What is the weather in Prague?')

        expect(result.output).toBe('The weather in Prague is sunny, 22°C.')
        expect(result.toolCalls).toHaveLength(1)
        expect(result.toolCalls[0].name).toBe('get_weather')
        expect(result.toolCalls[0].result).toEqual({ city: 'Prague', temp: 22, condition: 'sunny' })
        expect(result.usage.iterations).toBe(2)
    })

    it('should handle tool execution errors gracefully', async () => {
        const provider = createMockProvider([
            {
                content: null,
                toolCalls: [{ id: 'call_1', name: 'failing_tool', arguments: {} }],
                usage: { inputTokens: 10, outputTokens: 5 },
            },
            {
                content: 'The tool failed, but I can help another way.',
                toolCalls: [],
                usage: { inputTokens: 20, outputTokens: 10 },
            },
        ])

        const failingTool = defineTool({
            name: 'failing_tool',
            description: 'A tool that fails',
            parameters: z.object({}),
            execute: async () => {
                throw new Error('Tool failed!')
            },
        })

        const agent = createAgent({ provider, model: 'test', tools: [failingTool] })
        const result = await agent.run('Use the tool')

        expect(result.output).toBe('The tool failed, but I can help another way.')
        expect(result.toolCalls[0].result).toBe('Error: Tool failed!')
    })

    it('should respect maxIterations', async () => {
        // Provider always returns tool calls — would loop forever
        const provider = createMockProvider(
            Array.from({ length: 5 }, () => ({
                content: null,
                toolCalls: [{ id: 'call', name: 'loop_tool', arguments: {} }],
                usage: { inputTokens: 5, outputTokens: 5 },
            })),
        )

        const tool = defineTool({
            name: 'loop_tool',
            description: 'Loop',
            parameters: z.object({}),
            execute: async () => 'ok',
        })

        const agent = createAgent({
            provider,
            model: 'test',
            tools: [tool],
            maxIterations: 3,
        })

        const result = await agent.run('Loop forever')
        expect(result.usage.iterations).toBe(3)
    })

    it('should support structured output', async () => {
        const provider = createMockProvider([
            {
                content: '{"name": "Jan", "age": 30}',
                toolCalls: [],
                usage: { inputTokens: 10, outputTokens: 5 },
            },
        ])

        const agent = createAgent({ provider, model: 'test' })

        const schema = z.object({
            name: z.string(),
            age: z.number(),
        })

        const result = await agent.run('Extract', { outputSchema: schema })

        expect(result.output).toEqual({ name: 'Jan', age: 30 })
    })

    it('should support streaming with onToken callback', async () => {
        const provider = createMockProvider([
            { content: 'Hello!', toolCalls: [], usage: { inputTokens: 10, outputTokens: 5 } },
        ])

        const agent = createAgent({ provider, model: 'test' })

        const tokens: string[] = []
        const result = await agent.run('Hi', {
            onToken: (token) => tokens.push(token),
        })

        expect(result.output).toBe('Hello!')
        expect(tokens.join('')).toBe('Hello!')
    })

    it('should support multi-turn with messages', async () => {
        const provider = createMockProvider([
            {
                content: 'TypeScript is great!',
                toolCalls: [],
                usage: { inputTokens: 20, outputTokens: 10 },
            },
        ])

        const agent = createAgent({ provider, model: 'test' })

        const result = await agent.run('Tell me more', {
            messages: [
                { role: 'user', content: 'What is TypeScript?' },
                { role: 'assistant', content: 'A typed superset of JavaScript.' },
            ],
        })

        expect(result.output).toBe('TypeScript is great!')
        // messages: [prev user, prev assistant, new user, new assistant] = 4
        expect(result.messages).toHaveLength(4)
    })

    it('should call onToolCall and onToolResult callbacks', async () => {
        const provider = createMockProvider([
            {
                content: null,
                toolCalls: [{ id: 'c1', name: 'my_tool', arguments: { x: 1 } }],
                usage: { inputTokens: 10, outputTokens: 5 },
            },
            { content: 'Done', toolCalls: [], usage: { inputTokens: 15, outputTokens: 5 } },
        ])

        const tool = defineTool({
            name: 'my_tool',
            description: 'Test',
            parameters: z.object({ x: z.number() }),
            execute: async ({ x }) => x * 2,
        })

        const toolCallLog: string[] = []
        const toolResultLog: unknown[] = []

        const agent = createAgent({ provider, model: 'test', tools: [tool] })
        await agent.run('Use tool', {
            onToolCall: (name) => toolCallLog.push(name),
            onToolResult: (name, result) => toolResultLog.push({ name, result }),
        })

        expect(toolCallLog).toEqual(['my_tool'])
        expect(toolResultLog).toEqual([{ name: 'my_tool', result: 2 }])
    })

    it('should return config from getConfig()', () => {
        const provider = createMockProvider([])
        const agent = createAgent({
            provider,
            model: 'test',
            systemPrompt: 'Hello',
            maxIterations: 5,
        })

        const config = agent.getConfig()
        expect(config.model).toBe('test')
        expect(config.systemPrompt).toBe('Hello')
        expect(config.maxIterations).toBe(5)
    })
})
