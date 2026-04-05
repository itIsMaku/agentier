import { z } from 'zod'
import { defineTool } from '@agentier/core'
import { exec } from 'child_process'
import { isCommandAllowed } from './utils/security'

/**
 * Configuration options for the {@link shellTool} factory.
 */
export interface ShellToolOptions {
    /**
     * Regex patterns specifying which commands the tool is allowed to execute.
     * When provided, only matching commands are permitted.
     */
    allowedCommands?: RegExp[]

    /**
     * Regex patterns specifying which commands the tool must not execute.
     * When omitted, a default deny list blocks destructive operations such as
     * `rm -rf /`, `sudo`, `shutdown`, and `reboot`.
     */
    deniedCommands?: RegExp[]

    /**
     * Maximum time in milliseconds to wait for the command to complete.
     * @defaultValue `30_000` (30 seconds)
     */
    timeout?: number

    /**
     * Working directory in which the command is executed.
     * @defaultValue `process.cwd()`
     */
    cwd?: string

    /**
     * Maximum size in bytes for stdout and stderr buffers.
     * @defaultValue `1_048_576` (1 MB)
     */
    maxOutput?: number
}

/**
 * Creates a tool definition that executes shell commands via Node.js
 * `child_process.exec`.
 *
 * Commands are validated against configurable allow/deny regex lists before
 * execution. The parent context's abort signal is forwarded so the child
 * process is killed on cancellation.
 *
 * @param options - Optional configuration for command security, timeouts,
 *                  working directory, and output limits.
 * @returns A tool definition compatible with the agentier core runtime.
 *
 * @example
 * ```ts
 * import { shellTool } from '@agentier/tools'
 *
 * const tool = shellTool({
 *   cwd: '/project',
 *   timeout: 10_000,
 *   deniedCommands: [/rm/, /sudo/],
 * })
 * ```
 */
export function shellTool(options?: ShellToolOptions) {
    const {
        allowedCommands,
        deniedCommands,
        timeout = 30_000,
        cwd = process.cwd(),
        maxOutput = 1024 * 1024,
    } = options ?? {}

    return defineTool({
        name: 'shell',
        description: 'Execute a shell command and return stdout/stderr',
        parameters: z.object({
            command: z.string().describe('Shell command to execute'),
        }),
        execute: async ({ command }, context) => {
            if (!isCommandAllowed(command, allowedCommands, deniedCommands)) {
                throw new Error(`Command not allowed: ${command}`)
            }

            return new Promise<{ stdout: string; stderr: string; exitCode: number }>(
                (resolve, reject) => {
                    const child = exec(
                        command,
                        { cwd, timeout, maxBuffer: maxOutput },
                        (error, stdout, stderr) => {
                            if (error && error.killed) {
                                reject(new Error(`Command timed out after ${timeout}ms`))
                                return
                            }

                            resolve({
                                stdout: stdout.toString(),
                                stderr: stderr.toString(),
                                exitCode: error?.code ?? 0,
                            })
                        },
                    )

                    /** Kill the child process when the parent context is aborted. */
                    context.signal.addEventListener('abort', () => {
                        child.kill()
                    })
                },
            )
        },
    })
}
