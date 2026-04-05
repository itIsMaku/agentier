import { describe, it, expect } from 'bun:test'
import { z } from 'zod'
import { defineTool } from '../src/tool'
import { toolToJsonSchema, validateToolArgs } from '../src/tool'

describe('defineTool', () => {
    it('should create a tool from Zod schema', () => {
        const tool = defineTool({
            name: 'search',
            description: 'Search the web',
            parameters: z.object({
                query: z.string(),
                limit: z.number().optional().default(10),
            }),
            execute: async ({ query, limit }) => ({ query, limit }),
        })

        expect(tool.name).toBe('search')
        expect(tool.description).toBe('Search the web')
        expect(tool._isZod).toBe(true)
        expect(tool._jsonSchema).toBeDefined()
        expect(tool._jsonSchema?.type).toBe('object')
    })

    it('should create a tool from JSON schema', () => {
        const tool = defineTool({
            name: 'search',
            description: 'Search the web',
            parameters: {
                type: 'object' as const,
                properties: { query: { type: 'string' } },
                required: ['query'],
            },
            execute: async ({ query }: { query: string }) => query,
        })

        expect(tool._isZod).toBe(false)
        expect(tool._jsonSchema).toEqual({
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
        })
    })
})

describe('toolToJsonSchema', () => {
    it('should convert tool to JSON schema format for providers', () => {
        const tool = defineTool({
            name: 'test',
            description: 'Test tool',
            parameters: z.object({ value: z.string() }),
            execute: async () => 'ok',
        })

        const schema = toolToJsonSchema(tool)
        expect(schema.name).toBe('test')
        expect(schema.description).toBe('Test tool')
        expect(schema.parameters).toBeDefined()
    })
})

describe('validateToolArgs', () => {
    it('should validate args with Zod schema', () => {
        const tool = defineTool({
            name: 'test',
            description: 'Test',
            parameters: z.object({
                name: z.string(),
                age: z.number(),
            }),
            execute: async () => 'ok',
        })

        const validated = validateToolArgs(tool, { name: 'John', age: 30 })
        expect(validated).toEqual({ name: 'John', age: 30 })
    })

    it('should throw on invalid args with Zod schema', () => {
        const tool = defineTool({
            name: 'test',
            description: 'Test',
            parameters: z.object({
                name: z.string(),
            }),
            execute: async () => 'ok',
        })

        expect(() => validateToolArgs(tool, { name: 123 })).toThrow()
    })

    it('should pass through args for JSON schema (no validation)', () => {
        const tool = defineTool({
            name: 'test',
            description: 'Test',
            parameters: {
                type: 'object' as const,
                properties: { name: { type: 'string' } },
            },
            execute: async () => 'ok',
        })

        const result = validateToolArgs(tool, { name: 123 })
        expect(result).toEqual({ name: 123 })
    })
})
