import { describe, it, expect } from 'bun:test'
import { createAction, runMiddlewareChain } from '../src/middleware'
import type { Middleware, AgentAction } from '../src/types'

describe('createAction', () => {
    it('should create an action with timestamp and metadata', () => {
        const action = createAction('loop_start', { prompt: 'hello', config: {} as any })

        expect(action.type).toBe('loop_start')
        expect(action.payload.prompt).toBe('hello')
        expect(action.timestamp).toBeGreaterThan(0)
        expect(action.metadata).toEqual({})
    })
})

describe('runMiddlewareChain', () => {
    it('should execute without middleware', async () => {
        const action = createAction('loop_start', { prompt: 'test', config: {} as any })

        const result = await runMiddlewareChain([], action, async () =>
            createAction('loop_end', { result: {} as any, reason: 'complete' }),
        )

        expect(result.type).toBe('loop_end')
    })

    it('should execute middleware in order', async () => {
        const order: number[] = []

        const mw1: Middleware = async (action, next) => {
            order.push(1)
            const result = await next()
            order.push(4)
            return result
        }

        const mw2: Middleware = async (action, next) => {
            order.push(2)
            const result = await next()
            order.push(3)
            return result
        }

        const action = createAction('loop_start', { prompt: 'test', config: {} as any })

        await runMiddlewareChain([mw1, mw2], action, async () =>
            createAction('loop_end', { result: {} as any, reason: 'complete' }),
        )

        expect(order).toEqual([1, 2, 3, 4])
    })

    it('should allow middleware to short-circuit', async () => {
        const mw: Middleware = async (action, next) => {
            // Don't call next — return immediately
            return createAction('loop_end', { result: {} as any, reason: 'complete' })
        }

        const action = createAction('loop_start', { prompt: 'test', config: {} as any })
        let executeCalled = false

        await runMiddlewareChain([mw], action, async () => {
            executeCalled = true
            return createAction('loop_end', { result: {} as any, reason: 'complete' })
        })

        expect(executeCalled).toBe(false)
    })

    it('should propagate errors', async () => {
        const mw: Middleware = async (_action, next) => {
            return next()
        }

        const action = createAction('loop_start', { prompt: 'test', config: {} as any })

        await expect(
            runMiddlewareChain([mw], action, async () => {
                throw new Error('test error')
            }),
        ).rejects.toThrow('test error')
    })
})
