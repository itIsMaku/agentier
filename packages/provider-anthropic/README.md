# @agentier/anthropic

Native Anthropic Claude provider for [agentier](https://github.com/itIsMaku/agentier).

## Install

```bash
npm install @agentier/anthropic @agentier/core
```

## Usage

```ts
import { createAgent } from '@agentier/core'
import { anthropic } from '@agentier/anthropic'

const agent = createAgent({
    provider: anthropic({
        model: 'claude-sonnet-4-20250514',
        apiKey: process.env.ANTHROPIC_API_KEY,
    }),
})

const result = await agent.run('Hello!')
```

## Documentation

Full docs and examples: [github.com/itIsMaku/agentier](https://github.com/itIsMaku/agentier)

## License

MIT
