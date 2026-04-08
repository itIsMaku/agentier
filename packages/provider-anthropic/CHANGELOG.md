# @agentier/anthropic

## 1.0.0

### Minor Changes

- [#1](https://github.com/itIsMaku/agentier/pull/1) [`3f53745`](https://github.com/itIsMaku/agentier/commit/3f53745ed85b81a12f45e209ee8d9c747a00c1d2) Thanks [@itIsMaku](https://github.com/itIsMaku)! - Support multimodal (image) content in tool results and per-run model override
    - Tools can now return `ImageResult` objects that are automatically formatted as multimodal content blocks for each provider (OpenAI `image_url`, Anthropic `image` source, Google `inlineData`).
    - `RunOptions.model` allows overriding the model for a single `agent.run()` call without changing the agent configuration.

### Patch Changes

- Updated dependencies [[`3f53745`](https://github.com/itIsMaku/agentier/commit/3f53745ed85b81a12f45e209ee8d9c747a00c1d2)]:
    - @agentier/core@1.0.0

## 0.1.1

### Patch Changes

- Add package READMEs, license, repository metadata for npm.

- Updated dependencies []:
    - @agentier/core@0.1.1
