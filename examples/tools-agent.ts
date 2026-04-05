/**
 * Agent with tools — weather lookup example.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... bun run examples/tools-agent.ts
 */
import { createAgent, defineTool } from '@agentier/core'
import { anthropic } from '@agentier/anthropic'
import { z } from 'zod'

const weatherTool = defineTool({
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: z.object({
        city: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature unit'),
    }),
    execute: async ({ city, unit }) => {
        // Simulated weather API
        const temps: Record<string, number> = { Prague: 22, Berlin: 18, London: 15, Tokyo: 28 }
        const temp = temps[city] ?? Math.round(Math.random() * 30)
        return {
            city,
            temperature: unit === 'fahrenheit' ? Math.round((temp * 9) / 5 + 32) : temp,
            unit,
            condition: temp > 20 ? 'sunny' : 'cloudy',
        }
    },
})

const agent = createAgent({
    provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You help users check weather. Use the weather tool to get data.',
    tools: [weatherTool],
    maxIterations: 5,
})

const result = await agent.run('What is the weather in Prague and Tokyo?')

console.log(result.output)
console.log(`\nTool calls: ${result.toolCalls.map((tc) => tc.name).join(', ')}`)
console.log(`Iterations: ${result.usage.iterations} | Tokens: ${result.usage.totalTokens}`)
