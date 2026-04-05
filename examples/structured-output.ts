/**
 * Structured output — extract typed data from text.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run examples/structured-output.ts
 */
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'
import { z } from 'zod'

const ContactSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    company: z.string().optional(),
})

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'Extract contact information from the provided text.',
})

const result = await agent.run(
    'Hi, I am Jan Novak from Acme Corp. Reach me at jan@acme.cz or +420 123 456 789.',
    { outputSchema: ContactSchema },
)

console.log('Extracted contact:')
console.log(`  Name:    ${result.output.name}`)
console.log(`  Email:   ${result.output.email}`)
console.log(`  Phone:   ${result.output.phone ?? 'N/A'}`)
console.log(`  Company: ${result.output.company ?? 'N/A'}`)
