import type { MemoryProvider, Message } from '@agentier/core'

/**
 * Configuration options for {@link BufferMemory}.
 */
export interface BufferMemoryOptions {
    /**
     * Maximum number of estimated tokens to retain in the conversation history.
     * When exceeded, older non-system messages are dropped (FIFO).
     */
    maxTokens?: number

    /**
     * Maximum number of messages to retain in the conversation history.
     * System messages are always preserved; the limit applies to the remainder.
     */
    maxMessages?: number

    /**
     * Strategy used when trimming messages that exceed the limits.
     * Currently only `'fifo'` (first-in, first-out) is supported.
     */
    trimStrategy?: 'fifo'
}

/**
 * Estimates the token count of a message using a character-based heuristic.
 *
 * @internal
 * @param message - The message to estimate tokens for.
 * @returns Approximate number of tokens (roughly 1 token per 4 characters).
 */
function estimateTokens(message: Message): number {
    const content = message.content ?? ''
    return Math.ceil(content.length / 4)
}

/**
 * An in-memory {@link MemoryProvider} that stores conversation history in a
 * `Map` keyed by session ID. Messages can be automatically trimmed by count
 * or estimated token budget so the context window stays within bounds.
 *
 * @example
 * ```ts
 * import { BufferMemory } from '@agentier/memory'
 *
 * const memory = new BufferMemory({ maxMessages: 50, maxTokens: 4096 })
 *
 * await memory.save('session-1', [
 *   { role: 'user', content: 'Hello' },
 *   { role: 'assistant', content: 'Hi there!' },
 * ])
 *
 * const history = await memory.load('session-1')
 * ```
 */
export class BufferMemory implements MemoryProvider {
    /** @internal Map of session IDs to their message arrays. */
    private sessions = new Map<string, Message[]>()

    /** @internal Maximum token budget (undefined = unlimited). */
    private maxTokens: number | undefined

    /** @internal Maximum message count (undefined = unlimited). */
    private maxMessages: number | undefined

    /**
     * Creates a new `BufferMemory` instance.
     *
     * @param options - Optional configuration for message limits and trimming.
     */
    constructor(options?: BufferMemoryOptions) {
        this.maxTokens = options?.maxTokens
        this.maxMessages = options?.maxMessages
    }

    /**
     * Loads the conversation history for a given session.
     *
     * @param sessionId - Unique identifier for the conversation session.
     * @returns A shallow copy of the stored messages, or an empty array if the
     *          session does not exist.
     */
    async load(sessionId: string): Promise<Message[]> {
        return [...(this.sessions.get(sessionId) ?? [])]
    }

    /**
     * Saves messages for a session, applying any configured trimming limits
     * before storing.
     *
     * @param sessionId - Unique identifier for the conversation session.
     * @param messages - The full list of messages to persist.
     */
    async save(sessionId: string, messages: Message[]): Promise<void> {
        let trimmed = [...messages]
        trimmed = this.trimMessages(trimmed)
        this.sessions.set(sessionId, trimmed)
    }

    /**
     * Removes all stored messages for a session.
     *
     * @param sessionId - Unique identifier for the conversation session to clear.
     */
    async clear(sessionId: string): Promise<void> {
        this.sessions.delete(sessionId)
    }

    /**
     * Applies the configured `maxMessages` and `maxTokens` limits to a list of
     * messages. System messages are always preserved; only non-system messages
     * are subject to trimming (most-recent messages are kept).
     *
     * @internal
     * @param messages - The messages to trim.
     * @returns A new array containing only the messages that fit within the
     *          configured limits.
     */
    private trimMessages(messages: Message[]): Message[] {
        let result = [...messages]

        /** Trim by max messages */
        if (this.maxMessages && result.length > this.maxMessages) {
            const system = result.filter((m) => m.role === 'system')
            const rest = result.filter((m) => m.role !== 'system')
            const keep = rest.slice(rest.length - (this.maxMessages - system.length))
            result = [...system, ...keep]
        }

        /** Trim by max tokens */
        if (this.maxTokens) {
            const system = result.filter((m) => m.role === 'system')
            const rest = result.filter((m) => m.role !== 'system')

            let totalTokens = system.reduce((sum, m) => sum + estimateTokens(m), 0)

            /**
             * Add messages from the end until we hit the limit.
             * This ensures the most recent context is always preserved.
             */
            const kept: Message[] = []
            for (let i = rest.length - 1; i >= 0; i--) {
                const msgTokens = estimateTokens(rest[i])
                if (totalTokens + msgTokens > this.maxTokens) break

                kept.unshift(rest[i])
                totalTokens += msgTokens
            }

            result = [...system, ...kept]
        }

        return result
    }
}
