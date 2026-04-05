/**
 * Streaming — real-time token output with callbacks.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run examples/streaming.ts
 */
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a creative writer.',
})

const result = await agent.run('Write a haiku about TypeScript.', {
    onToken: (token) => process.stdout.write(token),
    onComplete: (result) => {
        console.log(`\n\n--- Done in ${result.duration}ms, ${result.usage.totalTokens} tokens ---`)
    },
})
