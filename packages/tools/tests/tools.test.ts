import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { readFileTool } from '../src/read-file'
import { writeFileTool } from '../src/write-file'
import { shellTool } from '../src/shell'
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const testDir = join(process.cwd(), '.test-tools')
const mockContext = {
    callId: 'test',
    signal: new AbortController().signal,
    messages: [],
}

describe('readFileTool', () => {
    beforeEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true })
        mkdirSync(testDir, { recursive: true })
        writeFileSync(join(testDir, 'test.txt'), 'hello world')
    })

    afterEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true })
    })

    it('should read a file', async () => {
        const tool = readFileTool({ basePath: testDir })
        const result = await tool.execute({ path: 'test.txt', encoding: 'utf-8' }, mockContext)
        expect(result).toBe('hello world')
    })

    it('should deny access to .env files', async () => {
        writeFileSync(join(testDir, '.env'), 'SECRET=123')
        const tool = readFileTool({ basePath: testDir })
        await expect(
            tool.execute({ path: '.env', encoding: 'utf-8' }, mockContext),
        ).rejects.toThrow('Access denied')
    })

    it('should deny path traversal', async () => {
        const tool = readFileTool({ basePath: testDir })
        await expect(
            tool.execute({ path: '../../../etc/passwd', encoding: 'utf-8' }, mockContext),
        ).rejects.toThrow('Access denied')
    })
})

describe('writeFileTool', () => {
    beforeEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true })
        mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
        if (existsSync(testDir)) rmSync(testDir, { recursive: true })
    })

    it('should write a file', async () => {
        const tool = writeFileTool({ basePath: testDir })
        const result = await tool.execute({ path: 'output.txt', content: 'hello' }, mockContext)
        expect(result).toContain('File written')
        expect(existsSync(join(testDir, 'output.txt'))).toBe(true)
    })

    it('should create nested directories', async () => {
        const tool = writeFileTool({ basePath: testDir })
        await tool.execute({ path: 'nested/dir/file.txt', content: 'deep' }, mockContext)
        expect(existsSync(join(testDir, 'nested/dir/file.txt'))).toBe(true)
    })
})

describe('shellTool', () => {
    it('should execute a command', async () => {
        const tool = shellTool()
        const result = await tool.execute({ command: 'echo hello' }, mockContext)
        expect(result.stdout.trim()).toBe('hello')
        expect(result.exitCode).toBe(0)
    })

    it('should deny dangerous commands', async () => {
        const tool = shellTool()
        await expect(tool.execute({ command: 'sudo rm -rf /' }, mockContext)).rejects.toThrow(
            'Command not allowed',
        )
    })
})
