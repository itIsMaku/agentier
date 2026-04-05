# Contributing to Agentier

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/itIsMaku/agentier.git
cd agentier

# Install dependencies
bun install

# Run tests
bun run test

# Typecheck
bun run typecheck
```

## Project Structure

This is a monorepo using Bun workspaces. Packages live in `packages/`:

| Package                | Path                          | Description                                        |
| ---------------------- | ----------------------------- | -------------------------------------------------- |
| `@agentier/core`       | `packages/core`               | Agent loop, types, `createAgent()`, `defineTool()` |
| `@agentier/openai`     | `packages/provider-openai`    | OpenAI-compatible provider                         |
| `@agentier/anthropic`  | `packages/provider-anthropic` | Anthropic Claude provider                          |
| `@agentier/google`     | `packages/provider-google`    | Google Gemini provider                             |
| `@agentier/middleware` | `packages/middleware`         | Built-in middleware                                |
| `@agentier/memory`     | `packages/memory`             | Memory providers                                   |
| `@agentier/tools`      | `packages/tools`              | Built-in tools                                     |

## Making Changes

1. **Create a branch** from `main`:

    ```bash
    git checkout -b feat/my-feature
    ```

2. **Make your changes** and write tests.

3. **Add a changeset** (if your change affects published packages):

    ```bash
    bunx changeset
    ```

    This will prompt you to select affected packages, bump type, and write a summary.

4. **Run checks**:

    ```bash
    bun run test
    bun run typecheck
    ```

5. **Open a PR** against `main`.

## Commit Convention

We use conventional-style commit messages:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `test:` — tests only
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — maintenance (deps, CI, etc.)

## Adding a New Provider

1. Create `packages/provider-<name>/` with the same structure as existing providers.
2. Implement the `ModelProvider` interface from `@agentier/core`.
3. Add `@agentier/core` as a peer dependency.
4. Add path mapping in the root `tsconfig.json`.
5. Write tests with a mock `fetch`.

## Adding a New Middleware

1. Create a new file in `packages/middleware/src/`.
2. Export a factory function that returns a `Middleware`.
3. Re-export from `packages/middleware/src/index.ts`.
4. Write tests.

## Code Style

- TypeScript strict mode
- No semicolons (Prettier handles this)
- Single quotes
- Trailing commas
- JSDoc on all exported symbols
