import { describe, it, expect, mock } from 'bun:test'
import { logMiddleware } from '../src/log'
import { retryMiddleware } from '../src/retry'
import { rateLimitMiddleware } from '../src/rate-limit'
import { cacheMiddleware } from '../src/cache'
import type { AgentAction } from '@agentier/core'

function makeAction(type: string, payload: Record<string, unknown> = {}): AgentAction {
    return { type: type as any, payload: payload as any, timestamp: Date.now(), metadata: {} }
}

function makeNext(result?: AgentAction) {
    return async () => result ?? makeAction('model_response', { response: {}, usage: {} })
}

describe('logMiddleware', () => {
    it('should log action and result', async () => {
        const logs: string[] = []
        const logger = {
            log: (...args: unknown[]) => logs.push(args.join(' ')),
            error: (...args: unknown[]) => logs.push('ERROR: ' + args.join(' ')),
        }

        const mw = logMiddleware({ logger })
        const action = makeAction('model_call', { model: 'gpt-4o' })

        await mw(action, makeNext())

        expect(logs.length).toBe(2)
        expect(logs[0]).toContain('model_call')
        expect(logs[1]).toContain('done')
    })

    it('should filter by action types', async () => {
        const logs: string[] = []
        const logger = {
            log: (...args: unknown[]) => logs.push(args.join(' ')),
            error: () => {},
        }

        const mw = logMiddleware({ actions: ['tool_call'], logger })

        await mw(makeAction('model_call'), makeNext())
        expect(logs).toHaveLength(0)

        await mw(makeAction('tool_call', { name: 'test' }), makeNext())
        expect(logs).toHaveLength(2)
    })
})

describe('retryMiddleware', () => {
    it('should retry on failure', async () => {
        let attempts = 0

        const mw = retryMiddleware({ maxRetries: 2, baseDelay: 10 })
        const action = makeAction('model_call')

        const result = await mw(action, async () => {
            attempts++
            if (attempts < 3) throw new Error('fail')
            return makeAction('model_response')
        })

        expect(attempts).toBe(3)
        expect(result.type).toBe('model_response')
    })

    it('should throw after max retries exhausted', async () => {
        const mw = retryMiddleware({ maxRetries: 1, baseDelay: 10 })
        const action = makeAction('model_call')

        await expect(
            mw(action, async () => {
                throw new Error('always fails')
            }),
        ).rejects.toThrow('always fails')
    })

    it('should skip non-matching action types', async () => {
        let attempts = 0

        const mw = retryMiddleware({ maxRetries: 3, retryOn: ['model_call'] })
        const action = makeAction('tool_call')

        await expect(
            mw(action, async () => {
                attempts++
                throw new Error('fail')
            }),
        ).rejects.toThrow('fail')

        expect(attempts).toBe(1) // No retry
    })
})

describe('rateLimitMiddleware', () => {
    it('should allow requests within limit', async () => {
        const mw = rateLimitMiddleware({ rpm: 10 })
        const action = makeAction('model_call')

        // Should complete without delay
        const start = Date.now()
        for (let i = 0; i < 5; i++) {
            await mw(action, makeNext())
        }
        expect(Date.now() - start).toBeLessThan(1000)
    })
})

describe('cacheMiddleware', () => {
    it('should cache model_call responses', async () => {
        let callCount = 0
        const mw = cacheMiddleware({ ttl: 5000 })
        const action = makeAction('model_call', {
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Hi' }],
            tools: [],
        })

        const next = async () => {
            callCount++
            return makeAction('model_response', { response: { content: 'cached' } })
        }

        await mw(action, next)
        await mw(action, next)

        expect(callCount).toBe(1) // Second call was cached
    })

    it('should skip non-model_call actions', async () => {
        let callCount = 0
        const mw = cacheMiddleware()
        const action = makeAction('tool_call', { name: 'test' })

        const next = async () => {
            callCount++
            return makeAction('tool_result')
        }

        await mw(action, next)
        await mw(action, next)

        expect(callCount).toBe(2) // No caching
    })
})
