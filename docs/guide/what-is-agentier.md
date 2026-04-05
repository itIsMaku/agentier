# What is Agentier?

Agentier is a TypeScript framework for building **AI agent loops**. An agent loop is a pattern where an LLM model repeatedly reasons about a task, invokes tools, and uses the results to continue reasoning — until it has a final answer.

## Why Agentier?

Most LLM SDKs give you a single chat completion call. Building an agent requires you to manually:

- Loop between the model and tool calls
- Parse and validate tool arguments
- Handle errors, retries, rate limits
- Manage conversation history
- Stream tokens to the user

Agentier handles all of this with a single `agent.run()` call.

## Key Features

- **Provider-agnostic** — One interface for OpenAI, Anthropic, Google, Ollama, and any OpenAI-compatible API
- **Type-safe tools** — Define tools with Zod schemas for automatic validation and TypeScript inference
- **Middleware** — Plug in logging, retry, rate limiting, caching, or your own custom middleware
- **Memory** — Persist conversations across runs with in-memory or file-based storage
- **Structured output** — Get typed objects from the model using Zod schemas
- **Streaming** — Real-time token callbacks
- **Production-ready** — Timeouts, abort signals, token budgets, iteration limits

## How It Works

```
User prompt
    ↓
┌─→ Model call (LLM)
│     ↓
│   Tool calls? ──No──→ Return response
│     ↓ Yes
│   Execute tools
│     ↓
│   Add results to conversation
└────┘
```

The agent loop continues until the model responds without requesting any tool calls, or a limit is reached (max iterations, token budget, timeout).
