# Structured Output

Use `outputSchema` to get typed, validated objects from the model instead of free-form text.

## Basic Usage

Pass a Zod schema as `outputSchema` in the run options. The agent parses and validates the model's response automatically:

```ts
import { createAgent } from '@agentier/core'
import { openai } from '@agentier/openai'
import { z } from 'zod'

const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    systemPrompt: 'You extract structured data from text.',
})

const ContactSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    company: z.string().optional(),
})

const result = await agent.run(
    'Extract contact info: "Reach out to Jane Smith at jane@acme.co or call 555-0123. She works at Acme Corp."',
    { outputSchema: ContactSchema },
)

// result.output is fully typed as { name, email, phone?, company? }
console.log(result.output.name) // "Jane Smith"
console.log(result.output.email) // "jane@acme.co"
console.log(result.output.phone) // "555-0123"
console.log(result.output.company) // "Acme Corp"
```

## How It Works Internally

When you provide an `outputSchema`, the agent:

1. **Injects instructions into the system prompt** telling the model to respond with JSON matching the schema
2. **Sends the schema** as part of the system prompt so the model knows the expected structure
3. **Parses the response** as JSON (handles markdown code blocks automatically)
4. **Validates with Zod** using the schema's `.parse()` method
5. **Retries on failure** - if parsing or validation fails, the agent asks the model to fix its output (up to 2 retries)

The injected system prompt addition looks like:

```
You MUST respond with valid JSON matching this schema. Output ONLY the JSON, no other text.
Schema: {"type":"object","properties":{"name":{"type":"string"},...}}
```

## Complex Schemas

Use any Zod features - nested objects, arrays, enums, unions:

```ts
const AnalysisSchema = z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
    topics: z.array(z.string()),
    entities: z.array(
        z.object({
            name: z.string(),
            type: z.enum(['person', 'organization', 'location', 'product']),
        }),
    ),
    summary: z.string(),
})

const result = await agent.run(
    'Analyze this review: "The new iPhone is amazing! Apple really outdid themselves this time."',
    { outputSchema: AnalysisSchema },
)

console.log(result.output.sentiment) // "positive"
console.log(result.output.entities) // [{ name: "Apple", type: "organization" }, ...]
```

## With Tools

Structured output works alongside tools. The agent can use tools during its reasoning loop, and the final response is parsed as structured output:

```ts
const agent = createAgent({
    provider: openai({ apiKey: process.env.OPENAI_API_KEY! }),
    model: 'gpt-4o',
    tools: [searchTool, fetchTool],
})

const ReportSchema = z.object({
    title: z.string(),
    findings: z.array(z.string()),
    sources: z.array(
        z.object({
            url: z.string(),
            title: z.string(),
        }),
    ),
})

const result = await agent.run('Research the latest TypeScript features and compile a report', {
    outputSchema: ReportSchema,
})

// The agent searched the web, then formatted its findings as structured data
console.log(result.output.title)
console.log(result.output.findings)
```

## Error Handling

If the model fails to produce valid JSON after all retries, an `AgentError` with code `'OUTPUT_PARSE_ERROR'` is thrown:

```ts
import { AgentError } from '@agentier/core'

try {
    const result = await agent.run('...', { outputSchema: MySchema })
} catch (err) {
    if (err instanceof AgentError && err.code === 'OUTPUT_PARSE_ERROR') {
        console.log('Model could not produce valid structured output')
        console.log('Last error:', err.cause?.message)
    }
}
```

## Tips

- **Use `.describe()` on Zod fields** to help the model understand what each field expects
- **Keep schemas focused** - smaller schemas with fewer optional fields produce more reliable results
- **Set `temperature: 0`** for more deterministic structured output
- **The retry mechanism** asks the model to correct itself, sending the validation error message, so most transient parse failures are recovered automatically

```ts
const schema = z.object({
    title: z.string().describe('A short, descriptive title'),
    score: z.number().min(1).max(10).describe('Rating from 1-10'),
    tags: z.array(z.string()).describe('Relevant topic tags'),
})

const result = await agent.run('Rate this article: ...', {
    outputSchema: schema,
    temperature: 0,
})
```
