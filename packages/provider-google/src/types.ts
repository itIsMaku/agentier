/**
 * Configuration for the Google (Gemini) provider.
 *
 * @example
 * ```ts
 * const config: GoogleProviderConfig = {
 *   apiKey: process.env.GOOGLE_API_KEY!,
 *   apiVersion: 'v1beta',
 * }
 * ```
 */
export interface GoogleProviderConfig {
    /** Google AI API key appended as a query parameter to each request. */
    apiKey: string
    /** Base URL for API requests. Defaults to `https://generativelanguage.googleapis.com/{apiVersion}`. */
    baseUrl?: string
    /** Gemini API version used in the default base URL. Defaults to `'v1beta'`. */
    apiVersion?: string
    /** Additional headers merged into every request. */
    defaultHeaders?: Record<string, string>
    /** Custom `fetch` implementation, useful for proxies or test doubles. */
    fetch?: typeof globalThis.fetch
}
