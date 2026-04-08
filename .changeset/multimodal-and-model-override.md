---
'@agentier/core': minor
'@agentier/openai': minor
'@agentier/anthropic': minor
'@agentier/google': minor
---

Support multimodal (image) content in tool results and per-run model override

- Tools can now return `ImageResult` objects that are automatically formatted as multimodal content blocks for each provider (OpenAI `image_url`, Anthropic `image` source, Google `inlineData`).
- `RunOptions.model` allows overriding the model for a single `agent.run()` call without changing the agent configuration.
