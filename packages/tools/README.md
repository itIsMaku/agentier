# @agentier/tools

Built-in tools for [agentier](https://github.com/itIsMaku/agentier) — readFile, writeFile, fetch, and shell.

## Install

```bash
npm install @agentier/tools @agentier/core
```

## Usage

```ts
import { createAgent } from '@agentier/core'
import { readFile, writeFile, fetchUrl, shell } from '@agentier/tools'

const agent = createAgent({
    provider: myProvider,
    tools: [readFile(), writeFile(), fetchUrl(), shell()],
})
```

## Documentation

Full docs and examples: [github.com/itIsMaku/agentier](https://github.com/itIsMaku/agentier)

## License

MIT
