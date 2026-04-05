import type { Message } from './message'

/**
 * Interface for persisting and retrieving conversation history across sessions.
 *
 * Implementations can store messages in-memory, on disk, in a database, or
 * any other backing store. The agent uses this to maintain context between
 * separate `run()` invocations.
 *
 * @example
 * ```ts
 * const memory: MemoryProvider = {
 *   async load(sessionId) { return db.getMessages(sessionId) },
 *   async save(sessionId, messages) { await db.setMessages(sessionId, messages) },
 *   async clear(sessionId) { await db.deleteMessages(sessionId) },
 * }
 * ```
 */
export interface MemoryProvider {
    /**
     * Loads the stored conversation history for the given session.
     *
     * @param sessionId - The unique identifier for the conversation session.
     * @returns A promise resolving to the array of messages in this session.
     */
    load(sessionId: string): Promise<Message[]>
    /**
     * Saves the conversation history for the given session, replacing any previously stored messages.
     *
     * @param sessionId - The unique identifier for the conversation session.
     * @param messages - The complete message history to persist.
     * @returns A promise that resolves when saving is complete.
     */
    save(sessionId: string, messages: Message[]): Promise<void>
    /**
     * Clears all stored messages for the given session.
     *
     * @param sessionId - The unique identifier for the conversation session.
     * @returns A promise that resolves when the session data has been deleted.
     */
    clear(sessionId: string): Promise<void>
}
