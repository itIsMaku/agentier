import { describe, it, expect } from 'bun:test'
import { openai } from '../src/provider'

function mockFetch(responseBody: unknown, status = 200) {
    return async (_url: string, _init: RequestInit) => {
        return new Response(JSON.stringify(responseBody), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

describe('openai provider', () => {
    it('should call chat endpoint and return response', async () => {
        const provider = openai({
            apiKey: 'test-key',
            fetch: mockFetch({
                choices: [
                    {
                        message: { content: 'Hello!', tool_calls: undefined },
                    },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 5 },
            }) as typeof fetch,
        })

        const result = await provider.chat({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Hi' }],
        })

        expect(result.content).toBe('Hello!')
        expect(result.toolCalls).toEqual([])
        expect(result.usage.inputTokens).toBe(10)
        expect(result.usage.outputTokens).toBe(5)
    })

    it('should handle tool calls in response', async () => {
        const provider = openai({
            apiKey: 'test-key',
            fetch: mockFetch({
                choices: [
                    {
                        message: {
                            content: null,
                            tool_calls: [
                                {
                                    id: 'call_1',
                                    type: 'function',
                                    function: { name: 'search', arguments: '{"query":"test"}' },
                                },
                            ],
                        },
                    },
                ],
                usage: { prompt_tokens: 20, completion_tokens: 10 },
            }) as typeof fetch,
        })

        const result = await provider.chat({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Search for test' }],
            tools: [{ name: 'search', description: 'Search', parameters: {} }],
        })

        expect(result.content).toBeNull()
        expect(result.toolCalls).toEqual([
            { id: 'call_1', name: 'search', arguments: { query: 'test' } },
        ])
    })

    it('should throw on API error', async () => {
        const provider = openai({
            apiKey: 'bad-key',
            fetch: mockFetch({ error: { message: 'Invalid API key' } }, 401) as typeof fetch,
        })

        await expect(
            provider.chat({ model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] }),
        ).rejects.toThrow('OpenAI API error (401)')
    })

    it('should use custom baseUrl', async () => {
        let calledUrl = ''
        const provider = openai({
            apiKey: 'test',
            baseUrl: 'http://localhost:11434/v1',
            fetch: async (url: string | URL | Request, init?: RequestInit) => {
                calledUrl = typeof url === 'string' ? url : url.toString()
                return new Response(
                    JSON.stringify({
                        choices: [{ message: { content: 'ok' } }],
                        usage: { prompt_tokens: 0, completion_tokens: 0 },
                    }),
                )
            },
        })

        await provider.chat({ model: 'llama3', messages: [{ role: 'user', content: 'Hi' }] })

        expect(calledUrl).toBe('http://localhost:11434/v1/chat/completions')
    })
})
