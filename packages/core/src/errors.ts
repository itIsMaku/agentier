/**
 * Discriminated error codes used by {@link AgentError} to identify the cause of failure.
 *
 * - `'MAX_ITERATIONS_EXCEEDED'` - The agent loop hit the maximum iteration count.
 * - `'MAX_TOKENS_EXCEEDED'` - The total token budget was exhausted.
 * - `'TIMEOUT'` - The run exceeded the configured wall-clock timeout.
 * - `'ABORTED'` - The run was cancelled via an external abort signal.
 * - `'MODEL_ERROR'` - The model provider returned an error.
 * - `'TOOL_VALIDATION_ERROR'` - Tool arguments failed schema validation.
 * - `'TOOL_EXECUTION_ERROR'` - A tool threw an error during execution.
 * - `'OUTPUT_PARSE_ERROR'` - The model's output could not be parsed as structured data.
 * - `'PROVIDER_ERROR'` - A generic provider-level error (e.g. stream ended unexpectedly).
 */
export type AgentErrorCode =
    | 'MAX_ITERATIONS_EXCEEDED'
    | 'MAX_TOKENS_EXCEEDED'
    | 'TIMEOUT'
    | 'ABORTED'
    | 'MODEL_ERROR'
    | 'TOOL_VALIDATION_ERROR'
    | 'TOOL_EXECUTION_ERROR'
    | 'OUTPUT_PARSE_ERROR'
    | 'PROVIDER_ERROR'

/**
 * Custom error class for all agent-related failures.
 * Extends the built-in `Error` with a machine-readable {@link code},
 * an optional {@link cause} error, and optional {@link context} metadata.
 *
 * @example
 * ```ts
 * try {
 *   await agent.run('...')
 * } catch (err) {
 *   if (err instanceof AgentError && err.code === 'TIMEOUT') {
 *     console.log('Agent timed out')
 *   }
 * }
 * ```
 */
export class AgentError extends Error {
    /**
     * Creates a new AgentError.
     *
     * @param message - A human-readable description of the error.
     * @param code - A machine-readable error code identifying the failure type.
     * @param cause - The underlying error that caused this failure, if any.
     * @param context - Additional metadata about the error context (e.g. tool name, iteration count).
     */
    constructor(
        message: string,
        public readonly code: AgentErrorCode,
        public readonly cause?: Error,
        public readonly context?: Record<string, unknown>,
    ) {
        super(message)
        this.name = 'AgentError'
    }
}
