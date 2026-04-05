# Getting Started

## Installation

Install the core package and at least one provider:

```bash
bun add @agentier/core @agentier/openai
```

Or with npm:

```bash
npm install @agentier/core @agentier/openai
```

## Your First Agent

```ts
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant.',
})

const result = await agent.run('What is TypeScript?')
console.log(result.output)
```

## Adding Tools

Tools let the agent take actions. Define them with Zod for type safety:

```ts
import { createAgent, defineTool } from '@agentier/core'
import { openai } from '@agentier/openai'
import { z } from 'zod'

const weatherTool = defineTool({
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: z.object({
        city: z.string().describe('City name'),
    }),
    execute: async ({ city }) => {
        // Call your weather API here
        return { city, temperature: 22, condition: 'sunny' }
    },
})

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    tools: [weatherTool],
    maxIterations: 5,
})

const result = await agent.run('What is the weather in Prague?')
console.log(result.output)
console.log(result.toolCalls) // [{ name: 'get_weather', arguments: { city: 'Prague' }, result: { ... } }]
```

## The Result Object

Every `agent.run()` returns a rich result:

```ts
const result = await agent.run('...')

result.output // Final text response (or typed object with outputSchema)
result.messages // Full conversation history
result.toolCalls // All tool calls executed [{ name, arguments, result, duration }]
result.usage // { totalTokens, inputTokens, outputTokens, iterations }
result.duration // Total run time in ms
```

## Next Steps

- [Agent Loop](/guide/agent-loop) — How the loop works in detail
- [Tools](/guide/tools) — Zod schemas, JSON Schema, built-in tools
- [Providers](/guide/providers) — OpenAI, Anthropic, Google, custom providers
- [Middleware](/guide/middleware) — Logging, retry, rate limiting, caching
- [Memory](/guide/memory) — Persist conversations across runs
- [Structured Output](/guide/structured-output) — Get typed objects from models
