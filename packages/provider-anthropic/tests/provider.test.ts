import { describe, it, expect } from 'bun:test'
import { anthropic } from '../src/provider'

function mockFetch(responseBody: unknown, status = 200) {
    return async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify(responseBody), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

describe('anthropic provider', () => {
    it('should call messages endpoint and return response', async () => {
        const provider = anthropic({
            apiKey: 'test-key',
            fetch: mockFetch({
                content: [{ type: 'text', text: 'Hello!' }],
                usage: { input_tokens: 10, output_tokens: 5 },
            }) as typeof fetch,
        })

        const result = await provider.chat({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hi' }],
        })

        expect(result.content).toBe('Hello!')
        expect(result.toolCalls).toEqual([])
        expect(result.usage.inputTokens).toBe(10)
        expect(result.usage.outputTokens).toBe(5)
    })

    it('should handle tool use in response', async () => {
        const provider = anthropic({
            apiKey: 'test-key',
            fetch: mockFetch({
                content: [
                    { type: 'tool_use', id: 'tu_1', name: 'search', input: { query: 'test' } },
                ],
                usage: { input_tokens: 20, output_tokens: 10 },
            }) as typeof fetch,
        })

        const result = await provider.chat({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Search for test' }],
            tools: [{ name: 'search', description: 'Search', parameters: {} }],
        })

        expect(result.content).toBeNull()
        expect(result.toolCalls).toEqual([
            { id: 'tu_1', name: 'search', arguments: { query: 'test' } },
        ])
    })

    it('should send correct headers', async () => {
        let capturedHeaders: Record<string, string> = {}

        const provider = anthropic({
            apiKey: 'sk-ant-test',
            fetch: async (_url: string | URL | Request, init?: RequestInit) => {
                capturedHeaders = Object.fromEntries(
                    Object.entries(init?.headers ?? {}).map(([k, v]) => [k, String(v)]),
                )
                return new Response(
                    JSON.stringify({
                        content: [{ type: 'text', text: 'ok' }],
                        usage: { input_tokens: 0, output_tokens: 0 },
                    }),
                )
            },
        })

        await provider.chat({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hi' }],
        })

        expect(capturedHeaders['x-api-key']).toBe('sk-ant-test')
        expect(capturedHeaders['anthropic-version']).toBe('2023-06-01')
    })

    it('should throw on API error', async () => {
        const provider = anthropic({
            apiKey: 'bad-key',
            fetch: mockFetch({ error: { message: 'Invalid API key' } }, 401) as typeof fetch,
        })

        await expect(
            provider.chat({
                model: 'claude-sonnet-4-20250514',
                messages: [{ role: 'user', content: 'Hi' }],
            }),
        ).rejects.toThrow('Anthropic API error (401)')
    })
})
