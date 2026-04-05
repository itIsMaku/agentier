# Providers

Providers connect agentier to LLM APIs. Each provider translates between agentier's unified `Message` format and the API's wire format.

## OpenAI

Works with OpenAI and any OpenAI-compatible API (Ollama, Groq, Together, Azure, etc.):

```ts
import { openai } from '@agentier/openai'

const provider = openai({
    apiKey: process.env.OPENAI_API_KEY!,
})
```

### OpenAI-Compatible Services

Point `baseUrl` at any compatible API:

```ts
// Ollama
const provider = openai({
    apiKey: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
})

// Groq
const provider = openai({
    apiKey: process.env.GROQ_API_KEY!,
    baseUrl: 'https://api.groq.com/openai/v1',
})

// Together AI
const provider = openai({
    apiKey: process.env.TOGETHER_API_KEY!,
    baseUrl: 'https://api.together.xyz/v1',
})
```

### Config Options

| Option           | Default                     | Description                          |
| ---------------- | --------------------------- | ------------------------------------ |
| `apiKey`         | (required)                  | API key for authentication           |
| `baseUrl`        | `https://api.openai.com/v1` | API base URL                         |
| `organization`   | `undefined`                 | OpenAI organization ID               |
| `defaultHeaders` | `{}`                        | Additional headers for every request |
| `fetch`          | `globalThis.fetch`          | Custom fetch implementation          |

## Anthropic

Uses the native Anthropic Messages API:

```ts
import { anthropic } from '@agentier/anthropic'

const provider = anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})
```

The Anthropic provider handles the differences in how Claude manages system prompts (separate from messages), tool use (content blocks), and streaming (SSE events like `content_block_start`, `content_block_delta`, `content_block_stop`).

### Config Options

| Option           | Default                     | Description                          |
| ---------------- | --------------------------- | ------------------------------------ |
| `apiKey`         | (required)                  | API key sent via `x-api-key` header  |
| `baseUrl`        | `https://api.anthropic.com` | API base URL                         |
| `apiVersion`     | `'2023-06-01'`              | Anthropic API version header         |
| `defaultHeaders` | `{}`                        | Additional headers for every request |
| `fetch`          | `globalThis.fetch`          | Custom fetch implementation          |

## Google Gemini

Uses the Gemini REST API:

```ts
import { google } from '@agentier/google'

const provider = google({
    apiKey: process.env.GOOGLE_API_KEY!,
})
```

### Config Options

| Option           | Default                                                  | Description                          |
| ---------------- | -------------------------------------------------------- | ------------------------------------ |
| `apiKey`         | (required)                                               | API key (passed as query parameter)  |
| `baseUrl`        | `https://generativelanguage.googleapis.com/{apiVersion}` | API base URL                         |
| `apiVersion`     | `'v1beta'`                                               | Gemini API version                   |
| `defaultHeaders` | `{}`                                                     | Additional headers for every request |
| `fetch`          | `globalThis.fetch`                                       | Custom fetch implementation          |

## Using a Provider

Pass the provider to `createAgent` along with the model name:

```ts
import { createAgent } from '@agentier/core'
import { anthropic } from '@agentier/anthropic'

const agent = createAgent({
    provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You are a helpful assistant.',
})
```

## Model Parameters

Set default sampling parameters on the agent, or override them per-run:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 2048,
})

// Override for a specific run
const result = await agent.run('Be creative', {
    temperature: 1.2,
    maxOutputTokens: 4096,
})
```

## Creating a Custom Provider

Implement the `ModelProvider` interface to connect any LLM:

```ts
import type { ModelProvider, ChatParams, ModelResponse, StreamEvent } from '@agentier/core'

const customProvider: ModelProvider = {
    name: 'my-provider',

    async chat(params: ChatParams): Promise<ModelResponse> {
        // Convert agentier messages to your API's format
        const body = {
            model: params.model,
            messages: params.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            // Map tool definitions if provided
            tools: params.tools?.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            })),
        }

        const response = await fetch('https://my-llm-api.com/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: params.signal,
        })

        const data = await response.json()

        // Convert the API response back to agentier's format
        return {
            content: data.text,
            toolCalls: (data.tool_calls ?? []).map((tc: any) => ({
                id: tc.id,
                name: tc.name,
                arguments: tc.args,
            })),
            usage: {
                inputTokens: data.usage.input,
                outputTokens: data.usage.output,
            },
            raw: data, // optional: attach the raw response
        }
    },

    async *stream(params: ChatParams): AsyncIterable<StreamEvent> {
        // Implement streaming - yield events as they arrive
        const response = await fetch('https://my-llm-api.com/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: params.model, messages: params.messages }),
            signal: params.signal,
        })

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value, { stream: true })
                fullContent += text
                yield { type: 'token', text }
            }
        } finally {
            reader.releaseLock()
        }

        // Always emit a 'done' event at the end
        yield {
            type: 'done',
            response: {
                content: fullContent,
                toolCalls: [],
                usage: { inputTokens: 0, outputTokens: 0 },
            },
        }
    },
}
```

### Stream Events

Your `stream` method should yield these events:

| Event                                             | Description                                |
| ------------------------------------------------- | ------------------------------------------ |
| `{ type: 'token', text }`                         | A chunk of generated text                  |
| `{ type: 'tool_call_start', id, name }`           | A tool call has begun                      |
| `{ type: 'tool_call_delta', id, argumentsDelta }` | Incremental tool call arguments            |
| `{ type: 'tool_call_end', id, call }`             | Tool call is complete                      |
| `{ type: 'done', response }`                      | Stream finished with final `ModelResponse` |
| `{ type: 'error', error }`                        | An error occurred                          |

The `done` event is required - the agent loop throws if the stream ends without it.

### Using Your Custom Provider

```ts
const agent = createAgent({
    provider: customProvider,
    model: 'my-model-v1',
    tools: [myTool],
})

const result = await agent.run('Hello!')
```
