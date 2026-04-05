# @agentier/core

Core agent loop engine for [agentier](https://github.com/itIsMaku/agentier) — provides `createAgent()`, `defineTool()`, and all base types.

## Install

```bash
npm install @agentier/core
```

## Usage

```ts
import { createAgent, defineTool } from '@agentier/core'

const agent = createAgent({
    provider: myProvider,
    tools: [
        defineTool({
            name: 'greet',
            description: 'Say hello',
            parameters: z.object({ name: z.string() }),
            execute: async ({ name }) => `Hello, ${name}!`,
        }),
    ],
})

const result = await agent.run('Greet the user')
```

## Documentation

Full docs and examples: [github.com/itIsMaku/agentier](https://github.com/itIsMaku/agentier)

## License

MIT
