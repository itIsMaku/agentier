# @agentier/memory

Memory providers for [agentier](https://github.com/itIsMaku/agentier) — BufferMemory and FileMemory.

## Install

```bash
npm install @agentier/memory @agentier/core
```

## Usage

```ts
import { createAgent } from '@agentier/core'
import { BufferMemory } from '@agentier/memory'

const agent = createAgent({
    provider: myProvider,
    memory: new BufferMemory({ maxMessages: 100 }),
})
```

## Documentation

Full docs and examples: [github.com/itIsMaku/agentier](https://github.com/itIsMaku/agentier)

## License

MIT
