/**
 * Multi-turn conversation with memory persistence.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... bun run examples/multi-turn.ts
 */
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'
import { BufferMemory } from '@agentier/memory'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful coding tutor. Be concise.',
    memory: new BufferMemory({ maxTokens: 16_000 }),
})

// First question
console.log('User: What is a closure in JavaScript?')
const r1 = await agent.run('What is a closure in JavaScript?', { sessionId: 'lesson-1' })
console.log(`Assistant: ${r1.output}\n`)

// Follow-up — memory is loaded automatically
console.log('User: Can you give me an example?')
const r2 = await agent.run('Can you give me an example?', { sessionId: 'lesson-1' })
console.log(`Assistant: ${r2.output}\n`)

// Another follow-up
console.log('User: When would I use this in practice?')
const r3 = await agent.run('When would I use this in practice?', { sessionId: 'lesson-1' })
console.log(`Assistant: ${r3.output}\n`)

console.log(`Total messages in session: ${r3.messages.length}`)
