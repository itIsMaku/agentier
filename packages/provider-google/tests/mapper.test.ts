import { describe, it, expect } from 'bun:test'
import { toGeminiContents, toGeminiTools, fromGeminiResponse } from '../src/mapper'
import type { Message } from '@agentier/core'

describe('toGeminiContents', () => {
    it('should extract system instruction', () => {
        const messages: Message[] = [
            { role: 'system', content: 'Be helpful' },
            { role: 'user', content: 'Hello' },
        ]

        const result = toGeminiContents(messages)
        expect(result.systemInstruction).toEqual({ parts: [{ text: 'Be helpful' }] })
        expect(result.contents).toEqual([{ role: 'user', parts: [{ text: 'Hello' }] }])
    })

    it('should map assistant to model role', () => {
        const messages: Message[] = [{ role: 'assistant', content: 'Hello!' }]

        const result = toGeminiContents(messages)
        expect(result.contents[0].role).toBe('model')
    })

    it('should convert assistant tool calls to functionCall parts', () => {
        const messages: Message[] = [
            {
                role: 'assistant',
                content: null,
                toolCalls: [{ id: 'c1', name: 'search', arguments: { q: 'test' } }],
            },
        ]

        const result = toGeminiContents(messages)
        expect(result.contents[0].parts).toEqual([
            { functionCall: { name: 'search', args: { q: 'test' } } },
        ])
    })

    it('should convert tool results to functionResponse parts', () => {
        const messages: Message[] = [
            { role: 'tool', content: 'result', name: 'search', toolCallId: 'c1' },
        ]

        const result = toGeminiContents(messages)
        expect(result.contents[0]).toEqual({
            role: 'user',
            parts: [{ functionResponse: { name: 'search', response: { content: 'result' } } }],
        })
    })

    it('should convert tool result with image to functionResponse + inlineData', () => {
        const messages: Message[] = [
            {
                role: 'tool',
                content: 'Screenshot captured',
                name: 'screenshot',
                toolCallId: 'c1',
                image: {
                    type: 'image',
                    mediaType: 'image/jpeg',
                    data: 'abc123base64',
                    text: 'Screenshot captured',
                },
            },
        ]

        const result = toGeminiContents(messages)
        expect(result.contents[0]).toEqual({
            role: 'user',
            parts: [
                {
                    functionResponse: {
                        name: 'screenshot',
                        response: { content: 'Screenshot captured' },
                    },
                },
                { inlineData: { mimeType: 'image/jpeg', data: 'abc123base64' } },
            ],
        })
    })
})

describe('toGeminiTools', () => {
    it('should convert to Gemini functionDeclarations format', () => {
        const result = toGeminiTools([
            { name: 'search', description: 'Search', parameters: { type: 'object' } },
        ])

        expect(result).toEqual([
            {
                functionDeclarations: [
                    { name: 'search', description: 'Search', parameters: { type: 'object' } },
                ],
            },
        ])
    })
})

describe('fromGeminiResponse', () => {
    it('should extract text from parts', () => {
        const result = fromGeminiResponse([{ content: { parts: [{ text: 'Hello!' }] } }])

        expect(result.text).toBe('Hello!')
        expect(result.toolCalls).toEqual([])
    })

    it('should extract function calls', () => {
        const result = fromGeminiResponse([
            {
                content: {
                    parts: [{ functionCall: { name: 'search', args: { q: 'test' } } }],
                },
            },
        ])

        expect(result.toolCalls).toEqual([
            { id: 'call_0', name: 'search', arguments: { q: 'test' } },
        ])
    })
})
