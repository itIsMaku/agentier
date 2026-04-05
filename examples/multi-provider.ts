/**
 * Multi-provider — compare responses from different models.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... GOOGLE_API_KEY=AI... \
 *     bun run examples/multi-provider.ts
 */
import { createAgent, defineTool } from '@agentier/core'
import { openai } from '@agentier/openai'
import { anthropic } from '@agentier/anthropic'
import { google } from '@agentier/google'
import { z } from 'zod'

const tools = [
    defineTool({
        name: 'calculate',
        description: 'Calculate a math expression',
        parameters: z.object({ expression: z.string() }),
        execute: async ({ expression }) => {
            return { result: new Function(`return ${expression}`)() }
        },
    }),
]

const systemPrompt = 'You are a helpful math tutor. Use the calculator when needed.'
const prompt = 'What is 17 * 23 + 42?'

const providers = [
    { name: 'GPT-4o', provider: openai({ apiKey: process.env.OPENAI_API_KEY! }), model: 'gpt-4o' },
    {
        name: 'Claude',
        provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }),
        model: 'claude-sonnet-4-20250514',
    },
    {
        name: 'Gemini',
        provider: google({ apiKey: process.env.GOOGLE_API_KEY! }),
        model: 'gemini-2.0-flash',
    },
]

const results = await Promise.all(
    providers.map(async ({ name, provider, model }) => {
        const agent = createAgent({ provider, model, systemPrompt, tools, maxIterations: 5 })
        const result = await agent.run(prompt)
        return {
            name,
            output: result.output,
            tokens: result.usage.totalTokens,
            ms: result.duration,
        }
    }),
)

for (const r of results) {
    console.log(`\n--- ${r.name} (${r.tokens} tokens, ${r.ms}ms) ---`)
    console.log(r.output)
}
