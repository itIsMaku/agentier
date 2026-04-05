# Agentier — Agent Guide

This file helps AI coding assistants (Claude Code, Cursor, Copilot, etc.) understand the project quickly.

## What is this?

Agentier is a TypeScript framework for building AI agent loops. It provides a provider-agnostic abstraction over LLM APIs (OpenAI, Anthropic, Google, and any OpenAI-compatible endpoint) with composable tools, middleware, memory, and structured output.

The core idea: you call `createAgent({ provider, model, tools, ... })` and get back an agent that runs a reasoning loop — calling the model, executing tools, feeding results back — until the model responds without tool calls.

## Monorepo layout

```
packages/
├── core/                 # The heart — agent loop, types, createAgent(), defineTool()
├── provider-openai/      # OpenAI-compatible provider (also Ollama, Groq, Together)
├── provider-anthropic/   # Native Anthropic Claude provider
├── provider-google/      # Native Google Gemini provider
├── middleware/            # Built-in middleware (log, retry, rate-limit, cache)
├── memory/               # Conversation persistence (BufferMemory, FileMemory)
└── tools/                # Built-in tools (readFile, writeFile, fetch, shell)
```

All packages follow the same structure:

```
packages/<name>/
├── src/
│   ├── index.ts          # Public exports
│   ├── ...               # Implementation files
│   └── types.ts          # Package-specific types (providers only)
└── tests/
    └── *.test.ts         # Tests using bun:test
```

## Where to start reading

1. **Types first** — `packages/core/src/types/` defines everything: `Message`, `Tool`, `ModelProvider`, `Middleware`, `AgentConfig`, `AgentResult`. Start here to understand the data model.
2. **Agent loop** — `packages/core/src/loop.ts` is the main engine. It orchestrates model calls, tool execution, middleware dispatch, and termination conditions.
3. **Tool system** — `packages/core/src/tool.ts` has `defineTool()` which handles Zod/JSON schema duality and validation.
4. **A provider** — pick any provider (e.g. `packages/provider-openai/src/provider.ts`) to see how `ModelProvider` is implemented. They all follow the same pattern: convert messages → call API → convert response.
5. **Tests** — `packages/core/tests/agent.test.ts` shows how everything fits together with a mock provider.

## Key abstractions

- **`ModelProvider`** — interface with `chat()` and `stream()` methods. Each provider package implements this for a specific API.
- **`Tool`** — has a name, description, Zod/JSON schema for parameters, and an `execute()` function. The agent validates args and calls execute during the loop.
- **`Middleware`** — function `(action, next) => Promise<AgentAction>`. Actions flow through the chain for every agent loop event (model calls, tool calls, errors, etc.).
- **`MemoryProvider`** — interface with `load()`, `save()`, `clear()` for persisting conversation history across `agent.run()` calls.

## Commands

```bash
bun install              # Install dependencies
bun run test             # Run all tests (84 tests across 13 files)
bun run typecheck        # TypeScript type checking
bunx changeset           # Add a changeset before opening a PR
```

## Architecture decisions

- **No SDK dependencies** — providers use raw `fetch()` against APIs, not official SDKs. This keeps the bundle small and avoids version conflicts. A custom `fetch` can be injected for testing.
- **Zod is the only runtime dependency** — used for tool parameter validation and structured output parsing. JSON schema is also supported as a zero-dependency alternative.
- **Middleware is action-based** — every step of the agent loop emits an action (`model_call`, `tool_call`, `error`, etc.) that flows through the middleware chain. This is more flexible than phase-based hooks.
- **Lockstep versioning** — all packages share the same version number, managed by Changesets.
- **Single root tsconfig** — there are no per-package tsconfig files. The root `tsconfig.json` uses `paths` to resolve workspace imports. This avoids `rootDir` conflicts.

## Common tasks

**Adding a new provider:**

1. Create `packages/provider-<name>/` with `src/types.ts`, `src/mapper.ts`, `src/provider.ts`, `src/index.ts`
2. Implement `ModelProvider` from `@agentier/core`
3. Add the mapper to convert between internal `Message` format and the API's wire format
4. Add path mapping in root `tsconfig.json`
5. Write tests with a mock `fetch`

**Adding a new middleware:**

1. Add a file in `packages/middleware/src/`
2. Export a factory function returning `Middleware`
3. Re-export from `packages/middleware/src/index.ts`

**Adding a new built-in tool:**

1. Add a file in `packages/tools/src/`
2. Use `defineTool()` from `@agentier/core` with Zod parameters
3. Use security utils from `./utils/security.ts` for path/URL/command validation
4. Re-export from `packages/tools/src/index.ts`

## Testing patterns

- Tests use `bun:test` (`describe`, `it`, `expect`)
- Providers are tested with a mock `fetch` that returns predefined responses
- The core agent is tested with a mock `ModelProvider` that returns predefined `ModelResponse` objects
- Tools and memory create temp directories (`.test-*`) that are cleaned up in `afterEach`
- No real API calls in tests — everything is mocked
