# @agentier/openai

OpenAI provider for the agentier framework. Works with any OpenAI-compatible API.

## Functions

### `openai(config)`

Creates an OpenAI-compatible `ModelProvider`. Supports both blocking `chat` and streaming `stream` completions via the `/chat/completions` endpoint.

```ts
function openai(config: OpenAIProviderConfig): ModelProvider
```

**Parameters:**

- `config` — Provider configuration including API key and optional overrides.

**Returns:** A `ModelProvider` wired to the OpenAI chat completions API.

**Example:**

```ts
import { openai } from '@agentier/openai'

const provider = openai({ apiKey: process.env.OPENAI_API_KEY! })
const response = await provider.chat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }],
})
```

---

## Interfaces

### `OpenAIProviderConfig`

```ts
interface OpenAIProviderConfig {
    apiKey: string
    baseUrl?: string
    organization?: string
    defaultHeaders?: Record<string, string>
    fetch?: typeof globalThis.fetch
}
```

| Property         | Type                       | Description                                                         |
| ---------------- | -------------------------- | ------------------------------------------------------------------- |
| `apiKey`         | `string`                   | OpenAI API key used for authentication.                             |
| `baseUrl`        | `string?`                  | Base URL for API requests. Defaults to `https://api.openai.com/v1`. |
| `organization`   | `string?`                  | OpenAI organization ID sent via the `OpenAI-Organization` header.   |
| `defaultHeaders` | `Record<string, string>?`  | Additional headers merged into every request.                       |
| `fetch`          | `typeof globalThis.fetch?` | Custom `fetch` implementation, useful for proxies or test doubles.  |
