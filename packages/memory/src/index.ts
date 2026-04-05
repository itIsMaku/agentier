/**
 * @module @agentier/memory
 *
 * Provides pluggable memory providers for persisting agent conversation
 * history. Two built-in implementations are included:
 *
 * - {@link BufferMemory} -- fast, in-memory storage with optional token/message
 *   limits.
 * - {@link FileMemory} -- filesystem-backed storage using JSON files.
 */

export { BufferMemory } from './buffer'
export type { BufferMemoryOptions } from './buffer'

export { FileMemory } from './file'
export type { FileMemoryOptions } from './file'
