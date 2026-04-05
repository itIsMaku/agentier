/**
 * @module @agentier/tools
 *
 * A collection of pre-built tool definitions for the agentier runtime.
 * Each factory function returns a tool that can be registered with an agent:
 *
 * - {@link readFileTool} -- Read files from the filesystem.
 * - {@link writeFileTool} -- Write or create files on the filesystem.
 * - {@link fetchTool} -- Make HTTP requests.
 * - {@link shellTool} -- Execute shell commands.
 *
 * All tools enforce configurable security boundaries (path globs, URL
 * regexes, command regexes) to limit what the agent is allowed to do.
 */

export { readFileTool } from './read-file'
export type { ReadFileToolOptions } from './read-file'

export { writeFileTool } from './write-file'
export type { WriteFileToolOptions } from './write-file'

export { fetchTool } from './fetch'
export type { FetchToolOptions } from './fetch'

export { shellTool } from './shell'
export type { ShellToolOptions } from './shell'
