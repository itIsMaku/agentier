# @agentier/openai

OpenAI-compatible provider for [agentier](https://github.com/itIsMaku/agentier) — works with GPT, Ollama, Groq, Together, and any OpenAI-compatible API.

## Install

```bash
npm install @agentier/openai @agentier/core
```

## Usage

```ts
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'

const agent = createAgent({
    provider: openai({ model: 'gpt-4o', apiKey: process.env.OPENAI_API_KEY }),
})

const result = await agent.run('Hello!')
```

## Documentation

Full docs and examples: [github.com/itIsMaku/agentier](https://github.com/itIsMaku/agentier)

## License

MIT
