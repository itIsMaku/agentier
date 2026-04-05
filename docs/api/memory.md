# @agentier/memory

Pluggable memory providers for persisting agent conversation history. Both implementations satisfy the `MemoryProvider` interface from `@agentier/core`.

## Classes

### `BufferMemory`

An in-memory `MemoryProvider` that stores conversation history in a `Map` keyed by session ID. Messages can be automatically trimmed by count or estimated token budget.

```ts
class BufferMemory implements MemoryProvider {
    constructor(options?: BufferMemoryOptions)
    load(sessionId: string): Promise<Message[]>
    save(sessionId: string, messages: Message[]): Promise<void>
    clear(sessionId: string): Promise<void>
}
```

**Example:**

```ts
import { BufferMemory } from '@agentier/memory'

const memory = new BufferMemory({ maxMessages: 50, maxTokens: 4096 })

const agent = createAgent({
    model: 'gpt-4o',
    provider: myProvider,
    memory,
})
```

---

### `FileMemory`

A filesystem-backed `MemoryProvider` that persists conversation history as JSON files on disk.

Two storage modes are supported:

- **Directory mode** (path does not end with `.json`) - each session is written to its own `<sessionId>.json` file.
- **Single-file mode** (path ends with `.json`) - all sessions are stored as keys in a single JSON object.

```ts
class FileMemory implements MemoryProvider {
    constructor(options: FileMemoryOptions)
    load(sessionId: string): Promise<Message[]>
    save(sessionId: string, messages: Message[]): Promise<void>
    clear(sessionId: string): Promise<void>
}
```

**Example:**

```ts
import { FileMemory } from '@agentier/memory'

// Directory mode
const memory = new FileMemory({ path: './data/sessions' })

// Single-file mode
const shared = new FileMemory({ path: './data/memory.json', maxMessages: 100 })
```

---

## Interfaces

### `BufferMemoryOptions`

```ts
interface BufferMemoryOptions {
    maxTokens?: number
    maxMessages?: number
    trimStrategy?: 'fifo'
}
```

| Property       | Type      | Description                                                                                     |
| -------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `maxTokens`    | `number?` | Maximum estimated tokens to retain. Older non-system messages are dropped (FIFO) when exceeded. |
| `maxMessages`  | `number?` | Maximum number of messages to retain. System messages are always preserved.                     |
| `trimStrategy` | `'fifo'?` | Trimming strategy. Currently only `'fifo'` is supported.                                        |

---

### `FileMemoryOptions`

```ts
interface FileMemoryOptions {
    path: string
    maxMessages?: number
}
```

| Property      | Type      | Description                                                                                                                          |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `path`        | `string`  | Storage path. If it ends with `.json`, all sessions share a single file. Otherwise, each session gets its own file in the directory. |
| `maxMessages` | `number?` | Maximum messages per session. System messages are always preserved.                                                                  |
