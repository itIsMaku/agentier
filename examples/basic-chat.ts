/**
 * Basic chat — simple agent without tools.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run examples/basic-chat.ts
 */
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a friendly assistant. Be concise.',
})

const result = await agent.run('What are the 3 most popular programming languages in 2025?')

console.log(result.output)
console.log(`\nTokens: ${result.usage.totalTokens} | Duration: ${result.duration}ms`)
