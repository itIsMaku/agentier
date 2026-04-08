---
'@agentier/openai': patch
---

Fix OpenAI provider rejecting image_url in tool messages by splitting into a text-only tool message followed by a user message with the image content.
