import { z } from 'zod'
import { defineTool } from '@agentier/core'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { isPathAllowed } from './utils/security'

/**
 * Configuration options for the {@link readFileTool} factory.
 */
export interface ReadFileToolOptions {
    /**
     * Glob patterns specifying which paths the tool is allowed to read.
     * When provided, only matching paths are accessible.
     */
    allowedPaths?: string[]

    /**
     * Glob patterns specifying which paths the tool must not read.
     * Defaults to node_modules and .env patterns.
     */
    deniedPaths?: string[]

    /**
     * Maximum file size in bytes that the tool will read.
     * Files exceeding this limit cause an error.
     * @defaultValue `1_048_576` (1 MB)
     */
    maxSize?: number

    /**
     * Base directory against which relative file paths are resolved.
     * @defaultValue `process.cwd()`
     */
    basePath?: string
}

/**
 * Creates a tool definition that reads file contents from the filesystem.
 *
 * The tool enforces path-based security via allow/deny glob patterns and
 * rejects files that exceed the configured size limit.
 *
 * @param options - Optional configuration for path security and size limits.
 * @returns A tool definition compatible with the agentier core runtime.
 *
 * @example
 * ```ts
 * import { readFileTool } from '@agentier/tools'
 *
 * const tool = readFileTool({
 *   basePath: '/project',
 *   maxSize: 512 * 1024,
 * })
 * ```
 */
export function readFileTool(options?: ReadFileToolOptions) {
    const {
        allowedPaths,
        deniedPaths = ['**/node_modules/**', '**/.env*'],
        maxSize = 1024 * 1024,
        basePath = process.cwd(),
    } = options ?? {}

    return defineTool({
        name: 'read_file',
        description: 'Read the contents of a file from the filesystem',
        parameters: z.object({
            path: z.string().describe('File path to read (relative or absolute)'),
            encoding: z
                .enum(['utf-8', 'base64'])
                .optional()
                .default('utf-8')
                .describe('File encoding'),
        }),
        execute: async ({ path: filePath, encoding }) => {
            if (!isPathAllowed(filePath, basePath, allowedPaths, deniedPaths)) {
                throw new Error(`Access denied: ${filePath}`)
            }

            const resolved = resolve(basePath, filePath)
            const { stat } = await import('fs/promises')
            const stats = await stat(resolved)

            if (stats.size > maxSize) {
                throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`)
            }

            return readFile(resolved, encoding as BufferEncoding)
        },
    })
}
