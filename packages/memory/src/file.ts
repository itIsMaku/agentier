import type { MemoryProvider, Message } from '@agentier/core'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

/**
 * Configuration options for {@link FileMemory}.
 */
export interface FileMemoryOptions {
    /**
     * Path to the storage location. If the path ends with `.json`, all sessions
     * are stored in that single file (keyed by session ID). Otherwise the path
     * is treated as a directory and each session gets its own
     * `<sessionId>.json` file.
     */
    path: string

    /**
     * Maximum number of messages to retain per session.
     * System messages are always preserved; the limit applies to the remainder.
     */
    maxMessages?: number
}

/**
 * A filesystem-backed {@link MemoryProvider} that persists conversation
 * history as JSON files on disk.
 *
 * Two storage modes are supported depending on the `path` option:
 * - **Directory mode** (`path` does not end with `.json`) -- each session is
 *   written to its own `<sessionId>.json` file inside the directory.
 * - **Single-file mode** (`path` ends with `.json`) -- all sessions are
 *   stored as keys in a single JSON object.
 *
 * @example
 * ```ts
 * import { FileMemory } from '@agentier/memory'
 *
 * // Directory mode -- one file per session
 * const memory = new FileMemory({ path: './data/sessions' })
 *
 * // Single-file mode -- all sessions in one file
 * const shared = new FileMemory({ path: './data/memory.json', maxMessages: 100 })
 * ```
 */
export class FileMemory implements MemoryProvider {
    /** @internal Absolute or relative base path for storage. */
    private basePath: string

    /** @internal Whether the provider is operating in directory mode. */
    private isDirectory: boolean

    /** @internal Optional cap on persisted message count. */
    private maxMessages: number | undefined

    /**
     * Creates a new `FileMemory` instance.
     *
     * @param options - Configuration specifying the storage path and optional
     *                  message limit.
     */
    constructor(options: FileMemoryOptions) {
        this.basePath = options.path
        this.isDirectory = !options.path.endsWith('.json')
        this.maxMessages = options.maxMessages
    }

    /**
     * Resolves the on-disk file path for a given session.
     *
     * @internal
     * @param sessionId - The session identifier.
     * @returns The absolute or relative path to the JSON file.
     */
    private getFilePath(sessionId: string): string {
        if (this.isDirectory) {
            return join(this.basePath, `${sessionId}.json`)
        }
        return this.basePath
    }

    /**
     * Returns the JSON key used to store messages for the session.
     *
     * @internal
     * @param sessionId - The session identifier.
     * @returns `'messages'` in directory mode, or the session ID in
     *          single-file mode.
     */
    private getStorageKey(sessionId: string): string {
        return this.isDirectory ? 'messages' : sessionId
    }

    /**
     * Loads the conversation history for a given session from disk.
     *
     * @param sessionId - Unique identifier for the conversation session.
     * @returns The stored messages, or an empty array if the session file does
     *          not exist or cannot be parsed.
     */
    async load(sessionId: string): Promise<Message[]> {
        const filePath = this.getFilePath(sessionId)

        try {
            const content = await readFile(filePath, 'utf-8')
            const data = JSON.parse(content)

            if (this.isDirectory) {
                return Array.isArray(data) ? data : []
            }

            /** Single file mode -- data is `{ [sessionId]: Message[] }` */
            return Array.isArray(data[sessionId]) ? data[sessionId] : []
        } catch {
            return []
        }
    }

    /**
     * Persists messages for a session to disk, applying the optional
     * `maxMessages` limit before writing. Parent directories are created
     * automatically if they do not exist.
     *
     * @param sessionId - Unique identifier for the conversation session.
     * @param messages - The full list of messages to persist.
     */
    async save(sessionId: string, messages: Message[]): Promise<void> {
        const filePath = this.getFilePath(sessionId)

        let trimmed = messages
        if (this.maxMessages && messages.length > this.maxMessages) {
            const system = messages.filter((m) => m.role === 'system')
            const rest = messages.filter((m) => m.role !== 'system')
            trimmed = [...system, ...rest.slice(rest.length - (this.maxMessages - system.length))]
        }

        /** Ensure the parent directory exists before writing. */
        const dir = dirname(filePath)
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true })
        }

        if (this.isDirectory) {
            await writeFile(filePath, JSON.stringify(trimmed, null, 2), 'utf-8')
        } else {
            /** Single file mode -- merge with existing data on disk. */
            let data: Record<string, Message[]> = {}
            try {
                const content = await readFile(filePath, 'utf-8')
                data = JSON.parse(content)
            } catch {
                /* File doesn't exist yet */
            }
            data[sessionId] = trimmed
            await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
        }
    }

    /**
     * Removes conversation history for a session. In directory mode the
     * session file is deleted; in single-file mode the session key is removed
     * from the shared JSON object.
     *
     * @param sessionId - Unique identifier for the conversation session to clear.
     */
    async clear(sessionId: string): Promise<void> {
        if (this.isDirectory) {
            const filePath = this.getFilePath(sessionId)
            try {
                const { unlink } = await import('fs/promises')
                await unlink(filePath)
            } catch {
                /* File doesn't exist */
            }
        } else {
            /** Single file mode -- remove the session key from the JSON object. */
            try {
                const content = await readFile(this.basePath, 'utf-8')
                const data = JSON.parse(content)
                delete data[sessionId]
                await writeFile(this.basePath, JSON.stringify(data, null, 2), 'utf-8')
            } catch {
                /* File doesn't exist */
            }
        }
    }
}
