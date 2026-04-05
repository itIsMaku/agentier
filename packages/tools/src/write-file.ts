import { z } from 'zod'
import { defineTool } from '@agentier/core'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { isPathAllowed } from './utils/security'

/**
 * Configuration options for the {@link writeFileTool} factory.
 */
export interface WriteFileToolOptions {
    /**
     * Glob patterns specifying which paths the tool is allowed to write to.
     * When provided, only matching paths are accessible.
     */
    allowedPaths?: string[]

    /**
     * Glob patterns specifying which paths the tool must not write to.
     * Defaults to node_modules and .env patterns.
     */
    deniedPaths?: string[]

    /**
     * Whether to automatically create parent directories if they do not exist.
     * @defaultValue `true`
     */
    createDirs?: boolean

    /**
     * Base directory against which relative file paths are resolved.
     * @defaultValue `process.cwd()`
     */
    basePath?: string
}

/**
 * Creates a tool definition that writes content to a file on the filesystem.
 *
 * The tool enforces path-based security via allow/deny glob patterns and
 * can optionally create intermediate directories.
 *
 * @param options - Optional configuration for path security and directory
 *                  creation.
 * @returns A tool definition compatible with the agentier core runtime.
 *
 * @example
 * ```ts
 * import { writeFileTool } from '@agentier/tools'
 *
 * const tool = writeFileTool({
 *   basePath: '/project',
 *   createDirs: true,
 * })
 * ```
 */
export function writeFileTool(options?: WriteFileToolOptions) {
    const {
        allowedPaths,
        deniedPaths = ['**/node_modules/**', '**/.env*'],
        createDirs = true,
        basePath = process.cwd(),
    } = options ?? {}

    return defineTool({
        name: 'write_file',
        description: 'Write content to a file (creates or overwrites)',
        parameters: z.object({
            path: z.string().describe('File path to write'),
            content: z.string().describe('Content to write to the file'),
        }),
        execute: async ({ path: filePath, content }) => {
            if (!isPathAllowed(filePath, basePath, allowedPaths, deniedPaths)) {
                throw new Error(`Access denied: ${filePath}`)
            }

            const resolved = resolve(basePath, filePath)

            if (createDirs) {
                await mkdir(dirname(resolved), { recursive: true })
            }

            await writeFile(resolved, content, 'utf-8')
            return `File written: ${filePath}`
        },
    })
}
