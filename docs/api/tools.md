# @agentier/tools

A collection of pre-built tool definitions for the agentier runtime. Each factory function returns a `Tool` that can be registered with an agent. All tools enforce configurable security boundaries to limit what the agent is allowed to do.

## Functions

### `readFileTool(options?)`

Creates a tool that reads file contents from the filesystem. Enforces path-based security via allow/deny glob patterns and rejects files exceeding the size limit.

```ts
function readFileTool(options?: ReadFileToolOptions): Tool
```

The returned tool accepts parameters:

- `path: string` - File path to read (relative or absolute).
- `encoding?: 'utf-8' | 'base64'` - File encoding. Defaults to `'utf-8'`.

**Example:**

```ts
import { readFileTool } from '@agentier/tools'

const tool = readFileTool({
    basePath: '/project',
    maxSize: 512 * 1024,
})
```

---

### `writeFileTool(options?)`

Creates a tool that writes content to a file on the filesystem. Enforces path-based security via allow/deny glob patterns and can optionally create intermediate directories.

```ts
function writeFileTool(options?: WriteFileToolOptions): Tool
```

The returned tool accepts parameters:

- `path: string` - File path to write.
- `content: string` - Content to write to the file.

**Example:**

```ts
import { writeFileTool } from '@agentier/tools'

const tool = writeFileTool({
    basePath: '/project',
    createDirs: true,
})
```

---

### `fetchTool(options?)`

Creates a tool that performs HTTP requests using the global `fetch` API. Validates URLs against optional allow/deny regex lists, enforces a request timeout, and truncates oversized response bodies.

```ts
function fetchTool(options?: FetchToolOptions): Tool
```

The returned tool accepts parameters:

- `url: string` - URL to fetch.
- `method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'` - HTTP method. Defaults to `'GET'`.
- `headers?: Record<string, string>` - HTTP headers.
- `body?: string` - Request body.

**Example:**

```ts
import { fetchTool } from '@agentier/tools'

const tool = fetchTool({
    allowedUrls: [/^https:\/\/api\.example\.com/],
    timeout: 10_000,
})
```

---

### `shellTool(options?)`

Creates a tool that executes shell commands via Node.js `child_process.exec`. Commands are validated against configurable allow/deny regex lists before execution.

```ts
function shellTool(options?: ShellToolOptions): Tool
```

The returned tool accepts parameters:

- `command: string` - Shell command to execute.

Returns `{ stdout: string; stderr: string; exitCode: number }`.

**Example:**

```ts
import { shellTool } from '@agentier/tools'

const tool = shellTool({
    cwd: '/project',
    timeout: 10_000,
    deniedCommands: [/rm/, /sudo/],
})
```

---

## Interfaces

### `ReadFileToolOptions`

```ts
interface ReadFileToolOptions {
    allowedPaths?: string[]
    deniedPaths?: string[]
    maxSize?: number
    basePath?: string
}
```

| Property       | Type        | Default                              | Description                                             |
| -------------- | ----------- | ------------------------------------ | ------------------------------------------------------- |
| `allowedPaths` | `string[]?` | _(none)_                             | Glob patterns specifying which paths the tool may read. |
| `deniedPaths`  | `string[]?` | `['**/node_modules/**', '**/.env*']` | Glob patterns specifying paths the tool must not read.  |
| `maxSize`      | `number?`   | `1048576` (1 MB)                     | Maximum file size in bytes.                             |
| `basePath`     | `string?`   | `process.cwd()`                      | Base directory for resolving relative paths.            |

---

### `WriteFileToolOptions`

```ts
interface WriteFileToolOptions {
    allowedPaths?: string[]
    deniedPaths?: string[]
    createDirs?: boolean
    basePath?: string
}
```

| Property       | Type        | Default                              | Description                                                 |
| -------------- | ----------- | ------------------------------------ | ----------------------------------------------------------- |
| `allowedPaths` | `string[]?` | _(none)_                             | Glob patterns specifying which paths the tool may write to. |
| `deniedPaths`  | `string[]?` | `['**/node_modules/**', '**/.env*']` | Glob patterns specifying paths the tool must not write to.  |
| `createDirs`   | `boolean?`  | `true`                               | Whether to automatically create parent directories.         |
| `basePath`     | `string?`   | `process.cwd()`                      | Base directory for resolving relative paths.                |

---

### `FetchToolOptions`

```ts
interface FetchToolOptions {
    allowedUrls?: RegExp[]
    deniedUrls?: RegExp[]
    timeout?: number
    maxResponseSize?: number
}
```

| Property          | Type        | Default          | Description                                                                     |
| ----------------- | ----------- | ---------------- | ------------------------------------------------------------------------------- |
| `allowedUrls`     | `RegExp[]?` | _(none)_         | Regex patterns specifying which URLs are allowed.                               |
| `deniedUrls`      | `RegExp[]?` | _(none)_         | Regex patterns specifying which URLs are blocked. Evaluated before allow rules. |
| `timeout`         | `number?`   | `30000` (30s)    | Maximum time in milliseconds to wait for a response.                            |
| `maxResponseSize` | `number?`   | `5242880` (5 MB) | Maximum response body size in bytes. Responses exceeding this are truncated.    |

---

### `ShellToolOptions`

```ts
interface ShellToolOptions {
    allowedCommands?: RegExp[]
    deniedCommands?: RegExp[]
    timeout?: number
    cwd?: string
    maxOutput?: number
}
```

| Property          | Type        | Default                | Description                                                                                                    |
| ----------------- | ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `allowedCommands` | `RegExp[]?` | _(none)_               | Regex patterns specifying which commands are permitted.                                                        |
| `deniedCommands`  | `RegExp[]?` | _(built-in deny list)_ | Regex patterns specifying which commands are blocked. Default blocks `rm -rf /`, `sudo`, `shutdown`, `reboot`. |
| `timeout`         | `number?`   | `30000` (30s)          | Maximum time in milliseconds for the command to complete.                                                      |
| `cwd`             | `string?`   | `process.cwd()`        | Working directory for command execution.                                                                       |
| `maxOutput`       | `number?`   | `1048576` (1 MB)       | Maximum size in bytes for stdout and stderr buffers.                                                           |
