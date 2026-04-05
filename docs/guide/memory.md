# Memory

Memory lets your agent maintain context across multiple `run()` calls. Without memory, each run starts with a fresh conversation.

## Manual Message Passing

The simplest approach is passing messages yourself:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant.',
})

// First turn
const result1 = await agent.run('My name is Alice.')

// Second turn - pass the previous messages
const result2 = await agent.run('What is my name?', {
    messages: result1.messages,
})

console.log(result2.output) // "Your name is Alice."
```

This works but requires you to manage the message array yourself.

## Using a MemoryProvider

Attach a `MemoryProvider` to the agent and it handles persistence automatically:

```ts
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'
import { BufferMemory } from '@agentier/memory'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant.',
    memory: new BufferMemory({ maxMessages: 50 }),
})

// Conversations are automatically saved and loaded
await agent.run('My name is Alice.')
const result = await agent.run('What is my name?')
console.log(result.output) // "Your name is Alice."
```

## BufferMemory

In-memory storage with optional trimming. Fast, but data is lost when the process exits:

```ts
import { BufferMemory } from '@agentier/memory'

// No limits
const memory = new BufferMemory()

// Limit by message count
const memory = new BufferMemory({ maxMessages: 100 })

// Limit by estimated tokens
const memory = new BufferMemory({ maxTokens: 8192 })

// Both limits (whichever is hit first)
const memory = new BufferMemory({
    maxMessages: 100,
    maxTokens: 8192,
})
```

When trimming, system messages are always preserved. The most recent non-system messages are kept.

| Option         | Default                | Description                                       |
| -------------- | ---------------------- | ------------------------------------------------- |
| `maxMessages`  | `undefined` (no limit) | Max messages to retain                            |
| `maxTokens`    | `undefined` (no limit) | Max estimated tokens to retain                    |
| `trimStrategy` | `'fifo'`               | Trimming strategy (oldest messages removed first) |

## FileMemory

Persists conversations as JSON files on disk. Survives process restarts:

```ts
import { FileMemory } from '@agentier/memory'

const memory = new FileMemory({
    path: './data/sessions',
})
```

### Directory Mode

When `path` does not end with `.json`, each session is stored as a separate file:

```ts
const memory = new FileMemory({ path: './data/sessions' })

// Creates:
// ./data/sessions/default.json
// ./data/sessions/user-42.json
// etc.
```

### Single-File Mode

When `path` ends with `.json`, all sessions are stored in one file keyed by session ID:

```ts
const memory = new FileMemory({ path: './data/memory.json' })

// Creates ./data/memory.json containing:
// {
//   "default": [...messages...],
//   "user-42": [...messages...]
// }
```

### Options

| Option        | Default                | Description                              |
| ------------- | ---------------------- | ---------------------------------------- |
| `path`        | (required)             | Storage path (directory or `.json` file) |
| `maxMessages` | `undefined` (no limit) | Max messages per session                 |

Parent directories are created automatically if they do not exist.

## Session IDs

Use session IDs to manage separate conversations with the same agent:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    memory: new BufferMemory(),
})

// User A's conversation
await agent.run('My name is Alice.', { sessionId: 'user-a' })

// User B's conversation (separate history)
await agent.run('My name is Bob.', { sessionId: 'user-b' })

// Each user has their own context
const resultA = await agent.run('What is my name?', { sessionId: 'user-a' })
console.log(resultA.output) // "Alice"

const resultB = await agent.run('What is my name?', { sessionId: 'user-b' })
console.log(resultB.output) // "Bob"
```

The default session ID is `'default'`.

## Skipping Memory Save

Sometimes you want to load context but not save the result (dry runs, previews, etc.):

```ts
const result = await agent.run('Preview this change', {
    skipMemorySave: true,
})
// Memory is loaded normally, but the conversation is NOT saved back
```

## Custom MemoryProvider

Implement the `MemoryProvider` interface to store conversations anywhere:

```ts
import type { MemoryProvider, Message } from '@agentier/core'

const redisMemory: MemoryProvider = {
    async load(sessionId: string): Promise<Message[]> {
        const data = await redis.get(`agent:${sessionId}`)
        return data ? JSON.parse(data) : []
    },

    async save(sessionId: string, messages: Message[]): Promise<void> {
        await redis.set(`agent:${sessionId}`, JSON.stringify(messages))
    },

    async clear(sessionId: string): Promise<void> {
        await redis.del(`agent:${sessionId}`)
    },
}

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    memory: redisMemory,
})
```

## Memory vs Messages Option

When both `memory` and `options.messages` are set, `messages` takes priority. The memory provider is only used to load history when `messages` is not provided:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    memory: new BufferMemory(),
})

// This IGNORES memory and uses the provided messages instead
await agent.run('Continue', {
    messages: [
        { role: 'user', content: 'Previous context here' },
        { role: 'assistant', content: 'Got it.' },
    ],
})
```
