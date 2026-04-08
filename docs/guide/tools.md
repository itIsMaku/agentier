# Tools

Tools let your agent interact with the outside world - read files, call APIs, run commands, or anything else you can express as a function.

## Defining Tools with Zod

The recommended way to define tools is with `defineTool()` and a Zod schema. You get full type inference and automatic JSON Schema generation:

```ts
import { defineTool } from '@agentier/core'
import { z } from 'zod'

const searchTool = defineTool({
    name: 'search',
    description: 'Search the web for information',
    parameters: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(5).describe('Max results'),
    }),
    execute: async ({ query, limit }) => {
        // `query` is typed as string, `limit` as number
        const results = await searchAPI(query, limit)
        return results
    },
})
```

The `name` and `description` are sent to the model so it knows when and how to call the tool. Use `.describe()` on Zod fields to document each parameter for the model.

## Defining Tools with JSON Schema

If you prefer plain JSON Schema, pass it directly instead of a Zod schema:

```ts
import { defineTool } from '@agentier/core'

const searchTool = defineTool({
    name: 'search',
    description: 'Search the web for information',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
    },
    execute: async ({ query, limit }) => {
        const results = await searchAPI(query, limit)
        return results
    },
})
```

::: tip
Zod schemas are validated at runtime - if the model sends malformed arguments, you get a clear validation error. JSON Schema parameters are passed through as-is.
:::

## The Execute Function

The `execute` function receives two arguments: the validated parameters and a `ToolContext`:

```ts
const tool = defineTool({
    name: 'example',
    description: 'Example tool',
    parameters: z.object({ input: z.string() }),
    execute: async (params, context) => {
        // params.input - validated parameters

        // context.callId - unique ID for this tool invocation
        // context.signal - AbortSignal (cancelled when agent times out)
        // context.messages - conversation history up to this point (readonly)

        return 'result'
    },
})
```

The `signal` is especially useful for long-running operations like HTTP requests:

```ts
execute: async ({ url }, { signal }) => {
    const response = await fetch(url, { signal })
    return response.text()
}
```

## Return Values

Tools can return different types:

```ts
// String - sent directly to the model
execute: async () => 'File contents here...'

// Object - JSON-stringified before sending to the model
execute: async () => ({ temperature: 22, city: 'Berlin' })

// void/undefined - sends "Tool executed successfully"
execute: async () => {
    await saveToDatabase(data)
}
```

### Image Results

Tools can return images that vision-capable models can analyze. Return an `ImageResult` object from your tool's execute function:

```ts
import { defineTool } from '@agentier/core'
import { z } from 'zod'

const screenshotTool = defineTool({
    name: 'screenshot',
    description: 'Capture a screenshot of the application',
    parameters: z.object({}),
    execute: async () => {
        const base64 = await captureScreenAsBase64()
        return {
            type: 'image',
            mediaType: 'image/jpeg', // 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
            data: base64, // base64-encoded image data
            text: 'Screenshot captured', // optional text alongside the image
        }
    },
})
```

The agent loop automatically detects `ImageResult` objects and formats them as multimodal content blocks for each provider:

- **OpenAI** — `image_url` content part with a `data:` URI
- **Anthropic** — `image` source block with `base64` encoding inside `tool_result`
- **Google Gemini** — `inlineData` part alongside the `functionResponse`

The `text` field is optional. When provided, it appears as a text content block alongside the image. When omitted, the default text `"Image result"` is used.

::: tip
Image results work with any vision-capable model (GPT-4o, Claude Sonnet/Opus, Gemini). The model receives the actual image — not the base64 string — so it can analyze visual content, describe screenshots, detect UI elements, etc.
:::

## Using Tools with an Agent

Pass tools to `createAgent` in the `tools` array:

```ts
import { createAgent, defineTool } from '@agentier/core'
import { openai } from '@agentier/openai'
import { z } from 'zod'

const calculator = defineTool({
    name: 'calculate',
    description: 'Evaluate a math expression',
    parameters: z.object({
        expression: z.string().describe('Math expression to evaluate'),
    }),
    execute: async ({ expression }) => {
        return String(eval(expression))
    },
})

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    tools: [calculator],
})

const result = await agent.run('What is 1234 * 5678?')
```

## Built-in Tools

The `@agentier/tools` package provides ready-made tools with security features.

### readFileTool

Reads files from the filesystem with path security:

```ts
import { readFileTool } from '@agentier/tools'

const tool = readFileTool({
    basePath: '/project', // resolve relative paths from here
    allowedPaths: ['src/**', 'docs/**'], // only these paths (globs)
    deniedPaths: ['**/node_modules/**', '**/.env*'], // blocked (default)
    maxSize: 512 * 1024, // max file size in bytes (default: 1MB)
})
```

| Option         | Default                              | Description                        |
| -------------- | ------------------------------------ | ---------------------------------- |
| `basePath`     | `process.cwd()`                      | Root directory for path resolution |
| `allowedPaths` | `undefined` (all allowed)            | Glob allowlist                     |
| `deniedPaths`  | `['**/node_modules/**', '**/.env*']` | Glob denylist                      |
| `maxSize`      | `1_048_576` (1 MB)                   | Max readable file size in bytes    |

### writeFileTool

Writes files with the same path security model:

```ts
import { writeFileTool } from '@agentier/tools'

const tool = writeFileTool({
    basePath: '/project',
    allowedPaths: ['src/**', 'output/**'],
    createDirs: true, // auto-create parent directories (default: true)
})
```

| Option         | Default                              | Description                          |
| -------------- | ------------------------------------ | ------------------------------------ |
| `basePath`     | `process.cwd()`                      | Root directory for path resolution   |
| `allowedPaths` | `undefined` (all allowed)            | Glob allowlist                       |
| `deniedPaths`  | `['**/node_modules/**', '**/.env*']` | Glob denylist                        |
| `createDirs`   | `true`                               | Create parent directories if missing |

### fetchTool

Makes HTTP requests with URL filtering:

```ts
import { fetchTool } from '@agentier/tools'

const tool = fetchTool({
    allowedUrls: [/^https:\/\/api\.example\.com/], // regex allowlist
    deniedUrls: [/localhost/, /127\.0\.0\.1/], // regex denylist
    timeout: 10_000, // request timeout (default: 30s)
    maxResponseSize: 1024 * 1024, // max body size (default: 5MB)
})
```

The tool supports `GET`, `POST`, `PUT`, `DELETE`, and `PATCH` methods. It forwards the agent's `AbortSignal`, so requests are cancelled when the agent times out. Large responses are automatically truncated.

| Option            | Default                   | Description                        |
| ----------------- | ------------------------- | ---------------------------------- |
| `allowedUrls`     | `undefined` (all allowed) | Regex URL allowlist                |
| `deniedUrls`      | `undefined`               | Regex URL denylist (checked first) |
| `timeout`         | `30_000`                  | Request timeout in ms              |
| `maxResponseSize` | `5_242_880` (5 MB)        | Max response body size             |

### shellTool

Executes shell commands with a built-in deny list:

```ts
import { shellTool } from '@agentier/tools'

const tool = shellTool({
    cwd: '/project',
    timeout: 10_000,
    allowedCommands: [/^ls/, /^cat/, /^grep/],
    deniedCommands: [/rm/, /sudo/], // default blocks rm -rf /, sudo, shutdown, reboot
    maxOutput: 512 * 1024,
})
```

| Option            | Default                                       | Description                   |
| ----------------- | --------------------------------------------- | ----------------------------- |
| `cwd`             | `process.cwd()`                               | Working directory             |
| `allowedCommands` | `undefined` (all allowed)                     | Regex command allowlist       |
| `deniedCommands`  | `[/rm -rf \//, /sudo/, /shutdown/, /reboot/]` | Regex command denylist        |
| `timeout`         | `30_000`                                      | Command timeout in ms         |
| `maxOutput`       | `1_048_576` (1 MB)                            | Max stdout/stderr buffer size |

### Combining Built-in Tools

```ts
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'
import { readFileTool, writeFileTool, shellTool } from '@agentier/tools'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You are a coding assistant. Use tools to read, write, and run code.',
    tools: [
        readFileTool({ basePath: './project' }),
        writeFileTool({ basePath: './project', allowedPaths: ['src/**'] }),
        shellTool({ cwd: './project', allowedCommands: [/^npm/, /^node/] }),
    ],
    maxIterations: 20,
})
```

## Path Security Model

The file tools share a security model based on glob patterns:

1. **Path traversal is always blocked** - `../etc/passwd` is rejected
2. **Deny patterns are checked first** - if a path matches any deny glob, it is rejected
3. **If allow patterns exist**, the path must match at least one
4. **If no allow patterns**, all non-denied paths are permitted

URL and command security follow the same deny-first, then allow logic.
