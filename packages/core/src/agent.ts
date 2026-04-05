import type { Agent, AgentConfig, AgentResult, RunOptions } from './types'
import { runAgentLoop } from './loop'

/**
 * Creates a new agent instance with the given configuration.
 *
 * The returned agent exposes a `run()` method for executing prompts through
 * the configured model and tools, and a `getConfig()` method for inspecting
 * the (frozen) configuration.
 *
 * @param config - The agent configuration including model, provider, tools, and limits.
 * @returns An {@link Agent} instance.
 *
 * @example
 * ```ts
 * import { createAgent, defineTool } from '@agenti/core'
 *
 * const agent = createAgent({
 *   model: 'gpt-4o',
 *   provider: myProvider,
 *   systemPrompt: 'You are a helpful assistant.',
 *   tools: [searchTool],
 * })
 *
 * const result = await agent.run('Find the latest news about AI.')
 * console.log(result.output)
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
    return {
        async run<T = string>(prompt: string, options?: RunOptions<T>): Promise<AgentResult<T>> {
            return runAgentLoop<T>(config, prompt, options)
        },
        getConfig() {
            return Object.freeze({ ...config })
        },
    }
}
