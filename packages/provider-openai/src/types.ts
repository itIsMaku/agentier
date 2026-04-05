/**
 * Configuration for the OpenAI provider.
 *
 * @example
 * ```ts
 * const config: OpenAIProviderConfig = {
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   organization: 'org-abc123',
 * }
 * ```
 */
export interface OpenAIProviderConfig {
    /** OpenAI API key used for authentication. */
    apiKey: string
    /** Base URL for API requests. Defaults to `https://api.openai.com/v1`. */
    baseUrl?: string
    /** OpenAI organization ID sent via the `OpenAI-Organization` header. */
    organization?: string
    /** Additional headers merged into every request. */
    defaultHeaders?: Record<string, string>
    /** Custom `fetch` implementation, useful for proxies or test doubles. */
    fetch?: typeof globalThis.fetch
}
