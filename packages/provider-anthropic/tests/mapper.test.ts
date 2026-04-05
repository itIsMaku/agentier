import { describe, it, expect } from 'bun:test'
import { toAnthropicMessages, toAnthropicTools, fromAnthropicResponse } from '../src/mapper'
import type { Message } from '@agentier/core'

describe('toAnthropicMessages', () => {
    it('should extract system prompt separately', () => {
        const messages: Message[] = [
            { role: 'system', content: 'Be helpful' },
            { role: 'user', content: 'Hello' },
        ]

        const result = toAnthropicMessages(messages)
        expect(result.system).toBe('Be helpful')
        expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }])
    })

    it('should convert assistant messages with tool calls', () => {
        const messages: Message[] = [
            {
                role: 'assistant',
                content: 'Let me check.',
                toolCalls: [{ id: 'tu_1', name: 'search', arguments: { q: 'test' } }],
            },
        ]

        const result = toAnthropicMessages(messages)
        expect(result.messages[0].content).toEqual([
            { type: 'text', text: 'Let me check.' },
            { type: 'tool_use', id: 'tu_1', name: 'search', input: { q: 'test' } },
        ])
    })

    it('should convert tool results to user messages with tool_result blocks', () => {
        const messages: Message[] = [{ role: 'tool', content: 'result data', toolCallId: 'tu_1' }]

        const result = toAnthropicMessages(messages)
        expect(result.messages[0]).toEqual({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'result data' }],
        })
    })
})

describe('toAnthropicTools', () => {
    it('should convert to Anthropic tool format', () => {
        const result = toAnthropicTools([
            {
                name: 'search',
                description: 'Search',
                parameters: { type: 'object', properties: {} },
            },
        ])

        expect(result).toEqual([
            {
                name: 'search',
                description: 'Search',
                input_schema: { type: 'object', properties: {} },
            },
        ])
    })
})

describe('fromAnthropicResponse', () => {
    it('should extract text and tool calls from content blocks', () => {
        const result = fromAnthropicResponse([
            { type: 'text', text: 'Checking...' },
            { type: 'tool_use', id: 'tu_1', name: 'search', input: { q: 'test' } },
        ])

        expect(result.text).toBe('Checking...')
        expect(result.toolCalls).toEqual([{ id: 'tu_1', name: 'search', arguments: { q: 'test' } }])
    })

    it('should return null text when no text blocks', () => {
        const result = fromAnthropicResponse([
            { type: 'tool_use', id: 'tu_1', name: 'search', input: {} },
        ])
        expect(result.text).toBeNull()
    })
})
