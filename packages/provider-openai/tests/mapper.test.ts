import { describe, it, expect } from 'bun:test'
import { toOpenAIMessages, toOpenAITools, fromOpenAIToolCalls } from '../src/mapper'
import type { Message, ToolJsonSchema } from '@agentier/core'

describe('toOpenAIMessages', () => {
    it('should convert simple messages', () => {
        const messages: Message[] = [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
        ]

        const result = toOpenAIMessages(messages)

        expect(result).toEqual([
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
        ])
    })

    it('should convert assistant message with tool calls', () => {
        const messages: Message[] = [
            {
                role: 'assistant',
                content: null,
                toolCalls: [{ id: 'call_1', name: 'search', arguments: { query: 'test' } }],
            },
        ]

        const result = toOpenAIMessages(messages)

        expect(result[0].tool_calls).toEqual([
            {
                id: 'call_1',
                type: 'function',
                function: { name: 'search', arguments: '{"query":"test"}' },
            },
        ])
    })

    it('should convert tool result messages', () => {
        const messages: Message[] = [
            { role: 'tool', content: 'search result', toolCallId: 'call_1' },
        ]

        const result = toOpenAIMessages(messages)
        expect(result[0]).toEqual({
            role: 'tool',
            content: 'search result',
            tool_call_id: 'call_1',
        })
    })

    it('should split tool result with image into tool message + user image message', () => {
        const messages: Message[] = [
            {
                role: 'tool',
                content: 'Screenshot captured',
                toolCallId: 'call_1',
                image: {
                    type: 'image',
                    mediaType: 'image/jpeg',
                    data: 'abc123base64',
                    text: 'Screenshot captured',
                },
            },
        ]

        const result = toOpenAIMessages(messages)
        expect(result).toHaveLength(2)

        // First: tool message with text-only content
        expect(result[0]).toEqual({
            role: 'tool',
            content: 'Screenshot captured',
            tool_call_id: 'call_1',
        })

        // Second: user message with image
        expect(result[1]).toEqual({
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: { url: 'data:image/jpeg;base64,abc123base64' },
                },
            ],
        })
    })

    it('should split tool result with image but null content', () => {
        const messages: Message[] = [
            {
                role: 'tool',
                content: null,
                toolCallId: 'call_2',
                image: {
                    type: 'image',
                    mediaType: 'image/png',
                    data: 'pngdata',
                },
            },
        ]

        const result = toOpenAIMessages(messages)
        expect(result).toHaveLength(2)
        expect(result[0].role).toBe('tool')
        expect(result[0].content).toBeNull()
        expect(result[1]).toEqual({
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,pngdata' } }],
        })
    })
})

describe('toOpenAITools', () => {
    it('should convert tool schemas to OpenAI format', () => {
        const tools: ToolJsonSchema[] = [
            {
                name: 'search',
                description: 'Search the web',
                parameters: { type: 'object', properties: { query: { type: 'string' } } },
            },
        ]

        const result = toOpenAITools(tools)

        expect(result).toEqual([
            {
                type: 'function',
                function: {
                    name: 'search',
                    description: 'Search the web',
                    parameters: { type: 'object', properties: { query: { type: 'string' } } },
                },
            },
        ])
    })
})

describe('fromOpenAIToolCalls', () => {
    it('should convert OpenAI tool calls to internal format', () => {
        const result = fromOpenAIToolCalls([
            {
                id: 'call_1',
                type: 'function',
                function: { name: 'search', arguments: '{"query":"test"}' },
            },
        ])

        expect(result).toEqual([{ id: 'call_1', name: 'search', arguments: { query: 'test' } }])
    })

    it('should return empty array for undefined', () => {
        expect(fromOpenAIToolCalls(undefined)).toEqual([])
    })
})
