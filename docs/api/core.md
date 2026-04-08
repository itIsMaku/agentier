# @agentier/core

The core package provides the foundational primitives for creating agents, defining tools, and handling errors.

## Functions

### `createAgent(config)`

Creates a new agent instance with the given configuration.

```ts
function createAgent(config: AgentConfig): Agent
```

**Parameters:**

- `config` — An `AgentConfig` object specifying the model, provider, tools, and limits.

**Returns:** An `Agent` instance with `run()` and `getConfig()` methods.

---

### `defineTool(config)`

Creates a fully configured tool with resolved JSON Schema metadata. This is the recommended way to define tools.

```ts
function defineTool<TParams, TResult = unknown>(config: {
    name: string
    description: string
    parameters: ZodType<TParams> | JsonSchema
    execute: (
        params: TParams,
        context: { callId: string; signal: AbortSignal; messages: readonly Message[] },
    ) => Promise<TResult>
}): Tool<TParams, TResult>
```

**Parameters:**

- `config.name` — Unique name identifying the tool.
- `config.description` — Human-readable description shown to the model.
- `config.parameters` — A Zod schema or plain JSON Schema defining accepted parameters.
- `config.execute` — Async function that performs the tool's work.

**Returns:** A `Tool<TParams, TResult>` ready to pass to an agent.

---

## Classes

### `AgentError`

Custom error class for all agent-related failures. Extends `Error` with a machine-readable code, optional cause, and optional context metadata.

```ts
class AgentError extends Error {
  constructor(
    message: string,
    readonly code: AgentErrorCode,
    readonly cause?: Error,
    readonly context?: Record<string, unknown>
  )
  name: 'AgentError'
}
```

**Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `code` | `AgentErrorCode` | Machine-readable error code identifying the failure type. |
| `cause` | `Error \| undefined` | The underlying error that caused this failure. |
| `context` | `Record<string, unknown> \| undefined` | Additional metadata (e.g. tool name, iteration count). |

---

## Interfaces

### `AgentConfig`

Configuration options for creating an agent.

```ts
interface AgentConfig {
    model: string
    provider: ModelProvider
    systemPrompt?: string
    tools?: Tool[]
    middleware?: Middleware[]
    memory?: MemoryProvider
    maxIterations?: number // default: 10
    maxTokens?: number // default: Infinity
    timeout?: number // default: 60000 (ms)
    temperature?: number
    topP?: number
    maxOutputTokens?: number
}
```

---

### `Agent`

The public interface of an agent created by `createAgent`.

```ts
interface Agent {
    run<T = string>(prompt: string, options?: RunOptions<T>): Promise<AgentResult<T>>
    getConfig(): Readonly<AgentConfig>
}
```

---

### `AgentResult<T>`

The result returned after an agent completes a run.

```ts
interface AgentResult<T = string> {
    output: T
    messages: Message[]
    toolCalls: ExecutedToolCall[]
    usage: UsageStats
    duration: number
}
```

| Field       | Description                                     |
| ----------- | ----------------------------------------------- |
| `output`    | The final output produced by the agent.         |
| `messages`  | Complete conversation history from the run.     |
| `toolCalls` | All tool calls executed during the run.         |
| `usage`     | Aggregated token usage statistics.              |
| `duration`  | Wall-clock duration of the run in milliseconds. |

---

### `RunOptions<T>`

Options passed to `Agent.run()` to customize a single run.

```ts
interface RunOptions<T = string> {
    messages?: Message[]
    outputSchema?: ZodType<T>
    temperature?: number
    maxOutputTokens?: number
    onToken?: (token: string) => void
    onToolCall?: (name: string, args: Record<string, unknown>) => void
    onToolResult?: (name: string, result: unknown) => void
    onComplete?: (result: AgentResult<T>) => void
    onError?: (error: Error) => void
    maxIterations?: number
    maxTokens?: number
    timeout?: number
    signal?: AbortSignal
    sessionId?: string // default: 'default'
    skipMemorySave?: boolean
}
```

---

### `Message`

A single message in the conversation history.

```ts
interface Message {
    role: Role
    content: string | null
    toolCalls?: ToolCall[]
    toolCallId?: string
    name?: string
    image?: ImageResult
}
```

| Field        | Type             | Description                                                                 |
| ------------ | ---------------- | --------------------------------------------------------------------------- |
| `role`       | `Role`           | The role of the message author.                                             |
| `content`    | `string \| null` | Text content, or `null` for tool-call-only assistant messages.              |
| `toolCalls`  | `ToolCall[]?`    | Tool calls requested by the assistant.                                      |
| `toolCallId` | `string?`        | ID of the tool call this message responds to (for `role: 'tool'`).          |
| `name`       | `string?`        | Optional display name for the author.                                       |
| `image`      | `ImageResult?`   | Image data attached to a tool result, formatted as multimodal by providers. |

---

### `ToolCall`

Represents a tool invocation requested by the model.

```ts
interface ToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
}
```

---

### `Tool<TParams, TResult>`

Defines a tool that the agent can invoke during its reasoning loop.

```ts
interface Tool<TParams = Record<string, unknown>, TResult = unknown> {
    name: string
    description: string
    parameters: ZodType<TParams> | JsonSchema
    execute: (params: TParams, context: ToolContext) => Promise<TResult>
}
```

---

### `ToolContext`

Contextual information provided to a tool's execute function.

```ts
interface ToolContext {
    callId: string
    signal: AbortSignal
    messages: Message[]
}
```

---

### `ModelProvider`

Interface that model providers must implement.

```ts
interface ModelProvider {
    readonly name: string
    chat(params: ChatParams): Promise<ModelResponse>
    stream(params: ChatParams): AsyncIterable<StreamEvent>
}
```

---

### `ChatParams`

Parameters for a chat completion request sent to a model provider.

```ts
interface ChatParams {
    model: string
    messages: Message[]
    tools?: ToolJsonSchema[]
    temperature?: number
    topP?: number
    maxOutputTokens?: number
    responseFormat?: {
        type: 'json_schema'
        schema: Record<string, unknown>
    }
    signal?: AbortSignal
}
```

---

### `ModelResponse`

The complete response returned by a model provider.

```ts
interface ModelResponse {
    content: string | null
    toolCalls: ToolCall[]
    usage: {
        inputTokens: number
        outputTokens: number
    }
    raw?: unknown
}
```

---

### `StreamEvent`

Events emitted during a streaming model response. A discriminated union on the `type` field.

```ts
type StreamEvent =
    | { type: 'token'; text: string }
    | { type: 'tool_call_start'; id: string; name: string }
    | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
    | { type: 'tool_call_end'; id: string; call: ToolCall }
    | { type: 'done'; response: ModelResponse }
    | { type: 'error'; error: Error }
```

---

### `Middleware`

A middleware function that intercepts actions flowing through the agent loop. Follows the standard "onion" pattern.

```ts
type Middleware = (action: AgentAction, next: () => Promise<AgentAction>) => Promise<AgentAction>
```

---

### `AgentAction<T>`

A typed action object that flows through the middleware pipeline.

```ts
interface AgentAction<T extends AgentActionType = AgentActionType> {
    type: T
    payload: T extends keyof ActionPayloadMap ? ActionPayloadMap[T] : never
    timestamp: number
    metadata: Record<string, unknown>
}
```

See `ActionPayloadMap` below for the payload shapes associated with each action type.

#### `ActionPayloadMap`

```ts
interface ActionPayloadMap {
    loop_start: { prompt: string; config: AgentConfig }
    loop_end: {
        result: AgentResult
        reason: 'complete' | 'max_iterations' | 'max_tokens' | 'timeout' | 'aborted'
    }
    model_call: { messages: Message[]; tools: ToolJsonSchema[]; model: string }
    model_response: {
        response: ModelResponse
        usage: { inputTokens: number; outputTokens: number }
    }
    tool_call: { id: string; name: string; arguments: Record<string, unknown> }
    tool_result: { id: string; name: string; result: unknown; duration: number }
    error: {
        source: 'model' | 'tool' | 'internal'
        error: Error
        name?: string
        retryable: boolean
    }
}
```

---

### `MemoryProvider`

Interface for persisting and retrieving conversation history across sessions.

```ts
interface MemoryProvider {
    load(sessionId: string): Promise<Message[]>
    save(sessionId: string, messages: Message[]): Promise<void>
    clear(sessionId: string): Promise<void>
}
```

---

### `UsageStats`

Aggregated token usage statistics for an agent run.

```ts
interface UsageStats {
    totalTokens: number
    inputTokens: number
    outputTokens: number
    iterations: number
    estimatedCost?: number
}
```

---

### `ExecutedToolCall`

A record of a single tool call executed during an agent run.

```ts
interface ExecutedToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
    result: unknown
    duration: number
}
```

---

## Types

### `Role`

```ts
type Role = 'system' | 'user' | 'assistant' | 'tool'
```

---

### `ImageMediaType`

MIME types supported for image content in tool results.

```ts
type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
```

---

### `ImageResult`

A structured image result returned by a tool's execute function. When the agent loop detects this in a tool result, it attaches it to the message so providers can format it as a multimodal content block.

```ts
interface ImageResult {
    type: 'image'
    mediaType: ImageMediaType
    data: string
    text?: string
}
```

| Field       | Type             | Description                                   |
| ----------- | ---------------- | --------------------------------------------- |
| `type`      | `'image'`        | Discriminator — must be `'image'`.            |
| `mediaType` | `ImageMediaType` | The MIME type of the image.                   |
| `data`      | `string`         | Base64-encoded image data.                    |
| `text`      | `string?`        | Optional text to include alongside the image. |

---

### `AgentActionType`

```ts
type AgentActionType =
    | 'loop_start'
    | 'loop_end'
    | 'model_call'
    | 'model_response'
    | 'tool_call'
    | 'tool_result'
    | 'error'
```

---

### `AgentErrorCode`

```ts
type AgentErrorCode =
    | 'MAX_ITERATIONS_EXCEEDED'
    | 'MAX_TOKENS_EXCEEDED'
    | 'TIMEOUT'
    | 'ABORTED'
    | 'MODEL_ERROR'
    | 'TOOL_VALIDATION_ERROR'
    | 'TOOL_EXECUTION_ERROR'
    | 'OUTPUT_PARSE_ERROR'
    | 'PROVIDER_ERROR'
```
