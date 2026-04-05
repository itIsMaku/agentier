# @agentier/anthropic

Anthropic provider for the agentier framework. Communicates via the Anthropic Messages API (`/v1/messages`).

## Functions

### `anthropic(config)`

Creates an Anthropic `ModelProvider`. Supports both blocking `chat` and streaming `stream` completions. Handles the Anthropic-specific SSE event protocol.

```ts
function anthropic(config: AnthropicProviderConfig): ModelProvider
```

**Parameters:**

- `config` — Provider configuration including API key and optional overrides.

**Returns:** A `ModelProvider` wired to the Anthropic Messages API.

**Example:**

```ts
import { anthropic } from '@agentier/anthropic'

const provider = anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const response = await provider.chat({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: 'Hello!' }],
})
```

---

## Interfaces

### `AnthropicProviderConfig`

```ts
interface AnthropicProviderConfig {
    apiKey: string
    baseUrl?: string
    apiVersion?: string
    defaultHeaders?: Record<string, string>
    fetch?: typeof globalThis.fetch
}
```

| Property         | Type                       | Description                                                                                |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| `apiKey`         | `string`                   | Anthropic API key sent via the `x-api-key` header.                                         |
| `baseUrl`        | `string?`                  | Base URL for API requests. Defaults to `https://api.anthropic.com`.                        |
| `apiVersion`     | `string?`                  | Anthropic API version sent via the `anthropic-version` header. Defaults to `'2023-06-01'`. |
| `defaultHeaders` | `Record<string, string>?`  | Additional headers merged into every request.                                              |
| `fetch`          | `typeof globalThis.fetch?` | Custom `fetch` implementation, useful for proxies or test doubles.                         |
