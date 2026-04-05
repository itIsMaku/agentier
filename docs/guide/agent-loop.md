# Agent Loop

The agent loop is the core engine of agentier. When you call `agent.run()`, it enters a loop that alternates between calling the model and executing tools until the model responds without any tool calls.

## Lifecycle

Each iteration of the loop follows this sequence:

1. **Check limits** - abort if `maxIterations`, `maxTokens`, or `timeout` is reached
2. **Call the model** - send the conversation history + tool definitions
3. **Append the assistant message** to the conversation
4. **If no tool calls** - the loop ends, return the result
5. **Execute all tool calls in parallel** - append results to the conversation
6. **Go to step 1**

```
┌─────────────────────────────────┐
│         agent.run(prompt)       │
└──────────────┬──────────────────┘
               │
               ▼
        ┌─────────────┐
        │ Check limits │──── exceeded? ──► return result
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │  Model call  │
        └──────┬──────┘
               │
               ▼
        ┌──────────────────┐
        │ Tool calls?      │──── no ──► return result
        └──────┬───────────┘
               │ yes
               ▼
        ┌──────────────────┐
        │ Execute tools    │
        │ (in parallel)    │
        └──────┬───────────┘
               │
               └──► back to Check limits
```

## Iteration Limits

Control how many times the model can be called before the loop stops:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    maxIterations: 15, // default: 10
})
```

Override per-run:

```ts
const result = await agent.run('Solve this step by step', {
    maxIterations: 25,
})
```

## Token Budget

Cap total token usage across all iterations:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    maxTokens: 50_000,
})
```

When the budget is exhausted, the loop ends and returns whatever output was produced.

## Timeout

Set a wall-clock timeout in milliseconds. The default is 60 seconds:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    timeout: 120_000, // 2 minutes
})
```

## Cancellation with AbortSignal

Pass an external `AbortSignal` to cancel a run at any time. The signal propagates to model calls and tool executions:

```ts
const controller = new AbortController()

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5_000)

try {
    const result = await agent.run('Analyze this dataset...', {
        signal: controller.signal,
    })
} catch (err) {
    if (err instanceof AgentError && err.code === 'ABORTED') {
        console.log('Run was cancelled')
    }
}
```

The agent creates its own internal `AbortController` that combines your signal with the timeout. When either triggers, all in-flight requests are aborted.

## Parallel Tool Execution

When the model requests multiple tool calls in a single response, they all execute concurrently:

```ts
// If the model calls get_weather("London") and get_weather("Paris") simultaneously,
// both run in parallel via Promise.all
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    tools: [weatherTool],
})
```

Each tool receives the `AbortSignal` through its context, so cancellation propagates to all parallel executions.

## Streaming

When you provide an `onToken` callback, the agent automatically uses the provider's streaming API:

```ts
const result = await agent.run('Write a poem about TypeScript', {
    onToken: (token) => process.stdout.write(token),
})
```

## Event Callbacks

Monitor the loop in real-time with callbacks:

```ts
const result = await agent.run('Search and summarize', {
    onToken: (token) => process.stdout.write(token),
    onToolCall: (name, args) => console.log(`Calling ${name}`, args),
    onToolResult: (name, result) => console.log(`${name} returned`, result),
    onComplete: (result) => console.log(`Done in ${result.duration}ms`),
    onError: (error) => console.error('Failed:', error),
})
```

## Error Handling

### Tool errors do not crash the loop

If a tool throws, the error message is sent back to the model as a tool result. The model can then decide to retry, try a different approach, or respond to the user:

```ts
const riskyTool = defineTool({
    name: 'fetch_data',
    description: 'Fetch data from an API',
    parameters: z.object({ url: z.string() }),
    execute: async ({ url }) => {
        throw new Error('Connection refused')
    },
})

// The model will see: "Error: Connection refused" as the tool result
// and can decide what to do next
```

### Model errors can be retried via middleware

Model API errors (rate limits, network failures) throw an `AgentError` with code `'MODEL_ERROR'`. Use the retry middleware to handle them automatically:

```ts
import { retryMiddleware } from '@agentier/middleware'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    middleware: [retryMiddleware({ maxRetries: 3, backoff: 'exponential' })],
})
```

### Catching specific errors

```ts
import { AgentError } from '@agentier/core'

try {
    const result = await agent.run('...')
} catch (err) {
    if (err instanceof AgentError) {
        switch (err.code) {
            case 'MODEL_ERROR':
                console.log('Model API failed:', err.cause)
                break
            case 'OUTPUT_PARSE_ERROR':
                console.log('Could not parse structured output')
                break
            case 'TIMEOUT':
                console.log('Run timed out')
                break
        }
    }
}
```

## The Result Object

Every run returns an `AgentResult` with full details:

```ts
const result = await agent.run('...')

result.output // Final assistant text (or typed object with outputSchema)
result.messages // Complete conversation history
result.toolCalls // All executed tool calls with timing
result.usage // { totalTokens, inputTokens, outputTokens, iterations }
result.duration // Wall-clock time in ms
```

The `usage.iterations` field tells you how many model calls were made. The `toolCalls` array includes each call's `duration` in milliseconds for performance profiling.
