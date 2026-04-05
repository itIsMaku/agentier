import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { BufferMemory } from '../src/buffer'
import { FileMemory } from '../src/file'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Message } from '@agentier/core'

describe('BufferMemory', () => {
    it('should store and load messages', async () => {
        const memory = new BufferMemory()
        const messages: Message[] = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
        ]

        await memory.save('session1', messages)
        const loaded = await memory.load('session1')

        expect(loaded).toEqual(messages)
    })

    it('should return empty array for unknown session', async () => {
        const memory = new BufferMemory()
        expect(await memory.load('unknown')).toEqual([])
    })

    it('should clear a session', async () => {
        const memory = new BufferMemory()
        await memory.save('s1', [{ role: 'user', content: 'Hi' }])
        await memory.clear('s1')
        expect(await memory.load('s1')).toEqual([])
    })

    it('should trim by maxMessages', async () => {
        const memory = new BufferMemory({ maxMessages: 3 })

        const messages: Message[] = [
            { role: 'system', content: 'System' },
            { role: 'user', content: 'msg1' },
            { role: 'assistant', content: 'resp1' },
            { role: 'user', content: 'msg2' },
            { role: 'assistant', content: 'resp2' },
        ]

        await memory.save('s1', messages)
        const loaded = await memory.load('s1')

        expect(loaded).toHaveLength(3)
        // System prompt should be preserved
        expect(loaded[0].role).toBe('system')
    })

    it('should trim by maxTokens', async () => {
        // ~4 chars per token, so maxTokens=5 means ~20 chars budget
        const memory = new BufferMemory({ maxTokens: 5 })

        const messages: Message[] = [
            { role: 'system', content: 'Sys' }, // ~1 token
            { role: 'user', content: 'A very long message that takes many tokens and more' }, // ~13 tokens
            { role: 'assistant', content: 'A long response that also takes tokens' }, // ~10 tokens
            { role: 'user', content: 'Short' }, // ~2 tokens
            { role: 'assistant', content: 'Ok' }, // ~1 token
        ]

        await memory.save('s1', messages)
        const loaded = await memory.load('s1')

        // Should have trimmed old messages but kept system
        expect(loaded[0].role).toBe('system')
        expect(loaded.length).toBeLessThan(messages.length)
    })
})

describe('FileMemory', () => {
    const testDir = join(process.cwd(), '.test-memory')

    beforeEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true })
        mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true })
    })

    it('should save and load from directory mode', async () => {
        const memory = new FileMemory({ path: testDir })
        const messages: Message[] = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
        ]

        await memory.save('session1', messages)
        const loaded = await memory.load('session1')

        expect(loaded).toEqual(messages)
        expect(existsSync(join(testDir, 'session1.json'))).toBe(true)
    })

    it('should save and load from single file mode', async () => {
        const filePath = join(testDir, 'history.json')
        const memory = new FileMemory({ path: filePath })

        await memory.save('s1', [{ role: 'user', content: 'Hello' }])
        await memory.save('s2', [{ role: 'user', content: 'World' }])

        expect(await memory.load('s1')).toEqual([{ role: 'user', content: 'Hello' }])
        expect(await memory.load('s2')).toEqual([{ role: 'user', content: 'World' }])
    })

    it('should return empty array for missing session', async () => {
        const memory = new FileMemory({ path: testDir })
        expect(await memory.load('missing')).toEqual([])
    })

    it('should clear a session in directory mode', async () => {
        const memory = new FileMemory({ path: testDir })
        await memory.save('s1', [{ role: 'user', content: 'Hi' }])
        await memory.clear('s1')
        expect(await memory.load('s1')).toEqual([])
        expect(existsSync(join(testDir, 's1.json'))).toBe(false)
    })
})
