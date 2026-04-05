import { z } from 'zod'
import { defineTool } from '@agentier/core'
import { isUrlAllowed } from './utils/security'

/**
 * Configuration options for the {@link fetchTool} factory.
 */
export interface FetchToolOptions {
    /**
     * Regex patterns specifying which URLs the tool is allowed to request.
     * When provided, only matching URLs are accessible.
     */
    allowedUrls?: RegExp[]

    /**
     * Regex patterns specifying which URLs the tool must not request.
     * Deny rules are evaluated before allow rules.
     */
    deniedUrls?: RegExp[]

    /**
     * Maximum time in milliseconds to wait for a response before aborting.
     * @defaultValue `30_000` (30 seconds)
     */
    timeout?: number

    /**
     * Maximum response body size in bytes. Responses exceeding this limit are
     * truncated and flagged with `truncated: true`.
     * @defaultValue `5_242_880` (5 MB)
     */
    maxResponseSize?: number
}

/**
 * Creates a tool definition that performs HTTP requests using the global
 * `fetch` API.
 *
 * The tool validates URLs against optional allow/deny regex lists, enforces
 * a request timeout, and truncates oversized response bodies. The parent
 * context's abort signal is forwarded so cancellation propagates correctly.
 *
 * @param options - Optional configuration for URL security, timeouts, and
 *                  response size limits.
 * @returns A tool definition compatible with the agentier core runtime.
 *
 * @example
 * ```ts
 * import { fetchTool } from '@agentier/tools'
 *
 * const tool = fetchTool({
 *   allowedUrls: [/^https:\/\/api\.example\.com/],
 *   timeout: 10_000,
 * })
 * ```
 */
export function fetchTool(options?: FetchToolOptions) {
    const {
        allowedUrls,
        deniedUrls,
        timeout = 30_000,
        maxResponseSize = 5 * 1024 * 1024,
    } = options ?? {}

    return defineTool({
        name: 'fetch',
        description: 'Make an HTTP request to a URL and return the response',
        parameters: z.object({
            url: z.string().url().describe('URL to fetch'),
            method: z
                .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
                .optional()
                .default('GET')
                .describe('HTTP method'),
            headers: z.record(z.string()).optional().describe('HTTP headers'),
            body: z.string().optional().describe('Request body'),
        }),
        execute: async ({ url, method, headers, body }, context) => {
            if (!isUrlAllowed(url, allowedUrls, deniedUrls)) {
                throw new Error(`URL not allowed: ${url}`)
            }

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)

            /** Propagate the parent context's abort signal. */
            context.signal.addEventListener('abort', () => controller.abort())

            try {
                const response = await fetch(url, {
                    method,
                    headers,
                    body: body ?? undefined,
                    signal: controller.signal,
                })

                const text = await response.text()

                if (text.length > maxResponseSize) {
                    return {
                        status: response.status,
                        headers: Object.fromEntries(response.headers.entries()),
                        body: text.slice(0, maxResponseSize) + '\n... [truncated]',
                        truncated: true,
                    }
                }

                return {
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: text,
                }
            } finally {
                clearTimeout(timeoutId)
            }
        },
    })
}
