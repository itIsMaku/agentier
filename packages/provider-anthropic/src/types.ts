/**
 * Configuration for the Anthropic provider.
 *
 * @example
 * ```ts
 * const config: AnthropicProviderConfig = {
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 *   apiVersion: '2023-06-01',
 * }
 * ```
 */
export interface AnthropicProviderConfig {
    /** Anthropic API key sent via the `x-api-key` header. */
    apiKey: string
    /** Base URL for API requests. Defaults to `https://api.anthropic.com`. */
    baseUrl?: string
    /** Anthropic API version sent via the `anthropic-version` header. Defaults to `'2023-06-01'`. */
    apiVersion?: string
    /** Additional headers merged into every request. */
    defaultHeaders?: Record<string, string>
    /** Custom `fetch` implementation, useful for proxies or test doubles. */
    fetch?: typeof globalThis.fetch
}
