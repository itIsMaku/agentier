# @agentier/google

Native Google Gemini provider for [agentier](https://github.com/itIsMaku/agentier).

## Install

```bash
npm install @agentier/google @agentier/core
```

## Usage

```ts
import { createAgent } from '@agentier/core'
import { google } from '@agentier/google'

const agent = createAgent({
    provider: google({ model: 'gemini-2.0-flash', apiKey: process.env.GOOGLE_API_KEY }),
})

const result = await agent.run('Hello!')
```

## Documentation

Full docs and examples: [github.com/itIsMaku/agentier](https://github.com/itIsMaku/agentier)

## License

MIT
