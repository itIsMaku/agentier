import { describe, it, expect } from 'bun:test'
import { google } from '../src/provider'

function mockFetch(responseBody: unknown, status = 200) {
    return async (_url: string | URL | Request, _init?: RequestInit) => {
        return new Response(JSON.stringify(responseBody), {
            status,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

describe('google provider', () => {
    it('should call generateContent and return response', async () => {
        const provider = google({
            apiKey: 'test-key',
            fetch: mockFetch({
                candidates: [{ content: { parts: [{ text: 'Hello!' }] } }],
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
            }) as typeof fetch,
        })

        const result = await provider.chat({
            model: 'gemini-2.0-flash',
            messages: [{ role: 'user', content: 'Hi' }],
        })

        expect(result.content).toBe('Hello!')
        expect(result.toolCalls).toEqual([])
        expect(result.usage.inputTokens).toBe(10)
        expect(result.usage.outputTokens).toBe(5)
    })

    it('should handle function calls', async () => {
        const provider = google({
            apiKey: 'test-key',
            fetch: mockFetch({
                candidates: [
                    {
                        content: {
                            parts: [{ functionCall: { name: 'search', args: { query: 'test' } } }],
                        },
                    },
                ],
                usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10 },
            }) as typeof fetch,
        })

        const result = await provider.chat({
            model: 'gemini-2.0-flash',
            messages: [{ role: 'user', content: 'Search' }],
        })

        expect(result.toolCalls).toEqual([
            { id: 'call_0', name: 'search', arguments: { query: 'test' } },
        ])
    })

    it('should include API key in URL', async () => {
        let calledUrl = ''
        const provider = google({
            apiKey: 'my-api-key',
            fetch: async (url: string | URL | Request, _init?: RequestInit) => {
                calledUrl = typeof url === 'string' ? url : url.toString()
                return new Response(
                    JSON.stringify({
                        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
                        usageMetadata: {},
                    }),
                )
            },
        })

        await provider.chat({
            model: 'gemini-2.0-flash',
            messages: [{ role: 'user', content: 'Hi' }],
        })

        expect(calledUrl).toContain('key=my-api-key')
        expect(calledUrl).toContain('gemini-2.0-flash:generateContent')
    })
})
