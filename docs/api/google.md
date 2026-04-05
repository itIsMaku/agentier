# @agentier/google

Google Gemini provider for the agentier framework. Communicates via the Gemini REST API.

## Functions

### `google(config)`

Creates a Google Gemini `ModelProvider`. Supports both blocking `chat` (via `generateContent`) and streaming `stream` (via `streamGenerateContent`) endpoints. The API key is passed as a query parameter.

```ts
function google(config: GoogleProviderConfig): ModelProvider
```

**Parameters:**

- `config` — Provider configuration including API key and optional overrides.

**Returns:** A `ModelProvider` wired to the Google Gemini API.

**Example:**

```ts
import { google } from '@agentier/google'

const provider = google({ apiKey: process.env.GOOGLE_API_KEY! })
const response = await provider.chat({
    model: 'gemini-2.0-flash',
    messages: [{ role: 'user', content: 'Hello!' }],
})
```

---

## Interfaces

### `GoogleProviderConfig`

```ts
interface GoogleProviderConfig {
    apiKey: string
    baseUrl?: string
    apiVersion?: string
    defaultHeaders?: Record<string, string>
    fetch?: typeof globalThis.fetch
}
```

| Property         | Type                       | Description                                                                                      |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `apiKey`         | `string`                   | Google AI API key appended as a query parameter to each request.                                 |
| `baseUrl`        | `string?`                  | Base URL for API requests. Defaults to `https://generativelanguage.googleapis.com/{apiVersion}`. |
| `apiVersion`     | `string?`                  | Gemini API version used in the default base URL. Defaults to `'v1beta'`.                         |
| `defaultHeaders` | `Record<string, string>?`  | Additional headers merged into every request.                                                    |
| `fetch`          | `typeof globalThis.fetch?` | Custom `fetch` implementation, useful for proxies or test doubles.                               |
