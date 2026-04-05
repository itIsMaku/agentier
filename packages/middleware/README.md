# @agentier/middleware

Built-in middleware for [agentier](https://github.com/itIsMaku/agentier) — log, retry, rate-limit, and cache.

## Install

```bash
npm install @agentier/middleware @agentier/core
```

## Usage

```ts
import { createAgent } from '@agentier/core'
import { log, retry, rateLimit, cache } from '@agentier/middleware'

const agent = createAgent({
    provider: myProvider,
    middleware: [log(), retry({ maxRetries: 3 }), rateLimit({ maxRpm: 60 }), cache()],
})
```

## Documentation

Full docs and examples: [github.com/itIsMaku/agentier](https://github.com/itIsMaku/agentier)

## License

MIT
