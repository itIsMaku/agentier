# agentier

A flexible, provider-agnostic TypeScript framework for building AI agent loops.

Build agents with any LLM model, plug in tools, middleware, memory, and structured output — all with full type safety.

## Features

- **Provider-agnostic** — OpenAI, Anthropic Claude, Google Gemini, Ollama, Groq, Together, and any OpenAI-compatible API
- **Tool support** — Define tools with Zod schemas (type-safe) or plain JSON schema
- **Middleware** — Action-based middleware chain (logging, retry, rate-limit, cache)
- **Memory** — In-memory or file-based conversation persistence
- **Structured output** — Get typed objects from models using Zod schemas
- **Streaming** — Real-time token streaming with callbacks
- **Multi-turn** — Built-in conversation/session management
- **Built-in tools** — File read/write, HTTP fetch, shell execution

## Install

```bash
bun add @agentier/core @agentier/openai
# or with other providers:
bun add @agentier/anthropic @agentier/google
# optional packages:
bun add @agentier/middleware @agentier/memory @agentier/tools
```

## Quick Start

```ts
import { createAgent, defineTool } from '@agentier/core'
import { openai } from '@agentier/openai'
import { z } from 'zod'

const searchTool = defineTool({
    name: 'search',
    description: 'Search the web',
    parameters: z.object({
        query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => {
        const res = await fetch(`https://api.example.com/search?q=${query}`)
        return res.json()
    },
})

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful research assistant.',
    tools: [searchTool],
    maxIterations: 10,
    timeout: 60_000,
})

const result = await agent.run('What are the latest trends in AI?')

console.log(result.output) // Final text response
console.log(result.usage) // { totalTokens, inputTokens, outputTokens, iterations }
console.log(result.toolCalls) // [{ name, arguments, result, duration }]
```

## Providers

### OpenAI (+ compatible APIs)

```ts
import { openai } from '@agentier/openai'

// OpenAI
const provider = openai({ apiKey: 'sk-...' })

// Ollama (local)
const provider = openai({ apiKey: 'ollama', baseUrl: 'http://localhost:11434/v1' })

// Groq
const provider = openai({ apiKey: 'gsk-...', baseUrl: 'https://api.groq.com/openai/v1' })
```

### Anthropic Claude

```ts
import { anthropic } from '@agentier/anthropic'

const provider = anthropic({ apiKey: 'sk-ant-...' })
```

### Google Gemini

```ts
import { google } from '@agentier/google'

const provider = google({ apiKey: 'AI...' })
```

### Custom Provider

Implement `ModelProvider` interface:

```ts
import type { ModelProvider } from '@agentier/core'

const myProvider: ModelProvider = {
    name: 'my-provider',
    async chat(params) {
        /* ... */
    },
    async *stream(params) {
        /* ... */
    },
}
```

## Tools

Define tools with Zod (type-safe + auto JSON schema) or plain JSON schema:

```ts
// Zod (recommended)
const tool = defineTool({
    name: 'get_weather',
    description: 'Get weather for a city',
    parameters: z.object({
        city: z.string(),
        unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    }),
    execute: async ({ city, unit }) => {
        return { city, temperature: 22, unit }
    },
})
```

### Built-in Tools

```ts
import { readFileTool, writeFileTool, fetchTool, shellTool } from '@agentier/tools'

const agent = createAgent({
    tools: [
        readFileTool({ basePath: './data' }),
        writeFileTool({ basePath: './output' }),
        fetchTool({ timeout: 10_000 }),
        shellTool({ deniedCommands: [/rm -rf/] }),
    ],
    // ...
})
```

## Middleware

Action-based middleware intercepts every step of the agent loop:

```ts
import {
    logMiddleware,
    retryMiddleware,
    rateLimitMiddleware,
    cacheMiddleware,
} from '@agentier/middleware'

const agent = createAgent({
    middleware: [
        logMiddleware({ actions: ['model_call', 'tool_call'] }),
        retryMiddleware({ maxRetries: 3, backoff: 'exponential' }),
        rateLimitMiddleware({ rpm: 60 }),
        cacheMiddleware({ ttl: 5 * 60 * 1000 }),
    ],
    // ...
})
```

### Custom Middleware

```ts
import type { Middleware } from '@agentier/core'

const myMiddleware: Middleware = async (action, next) => {
    console.log(`[${action.type}]`, action.payload)
    const result = await next()
    return result
}
```

Action types: `loop_start`, `loop_end`, `model_call`, `model_response`, `tool_call`, `tool_result`, `error`

## Memory

```ts
import { BufferMemory } from '@agentier/memory'

const agent = createAgent({
    memory: new BufferMemory({ maxTokens: 16_000 }),
    // ...
})

// Multi-turn with automatic memory
const r1 = await agent.run('What is TypeScript?', { sessionId: 'chat-1' })
const r2 = await agent.run('Give me an example', { sessionId: 'chat-1' }) // remembers context

// Or pass messages manually
const r2 = await agent.run('Give me an example', { messages: r1.messages })
```

## Structured Output

```ts
const schema = z.object({
    name: z.string(),
    email: z.string().email(),
})

const result = await agent.run('Extract contact from: ...', { outputSchema: schema })
// result.output is typed as { name: string, email: string }
```

## Streaming

```ts
const result = await agent.run('Write a poem', {
    onToken: (token) => process.stdout.write(token),
    onToolCall: (name, args) => console.log(`Calling ${name}`),
    onToolResult: (name, result) => console.log(`${name} done`),
    onComplete: (result) => console.log('Done!'),
})
```

## Packages

| Package                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `@agentier/core`       | Agent loop engine, types, `createAgent()`, `defineTool()`   |
| `@agentier/openai`     | OpenAI-compatible provider (GPT, Ollama, Groq, Together...) |
| `@agentier/anthropic`  | Native Anthropic Claude provider                            |
| `@agentier/google`     | Native Google Gemini provider                               |
| `@agentier/middleware` | Logging, retry, rate-limit, cache middleware                |
| `@agentier/memory`     | BufferMemory, FileMemory                                    |
| `@agentier/tools`      | Built-in tools (readFile, writeFile, fetch, shell)          |

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun run test

# Type check
bun run typecheck
```

## License

MIT
