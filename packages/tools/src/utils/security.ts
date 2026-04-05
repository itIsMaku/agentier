/**
 * @module security
 *
 * Utility functions for validating file paths, URLs, and shell commands
 * against configurable allow/deny lists. Used internally by the tool
 * implementations to enforce security boundaries.
 */

import { resolve, relative } from 'path'

/**
 * Checks whether a file path is permitted given a base directory and
 * optional allow/deny glob patterns.
 *
 * Evaluation order:
 * 1. Path traversal outside `basePath` is always denied.
 * 2. If the path matches any `deniedPaths` pattern it is denied.
 * 3. If `allowedPaths` is provided and non-empty, the path must match at
 *    least one pattern.
 * 4. Otherwise the path is allowed.
 *
 * @param filePath - The file path to check (relative or absolute).
 * @param basePath - The root directory all paths are resolved against.
 * @param allowedPaths - Optional glob patterns that explicitly allow access.
 * @param deniedPaths - Optional glob patterns that explicitly deny access.
 * @returns `true` if the path is permitted, `false` otherwise.
 *
 * @example
 * ```ts
 * isPathAllowed('src/index.ts', '/project')           // true
 * isPathAllowed('../etc/passwd', '/project')           // false (traversal)
 * isPathAllowed('.env.local', '/project', undefined,
 *   ['.env*'])                                          // false (denied)
 * ```
 */
export function isPathAllowed(
    filePath: string,
    basePath: string,
    allowedPaths?: string[],
    deniedPaths?: string[],
): boolean {
    const resolved = resolve(basePath, filePath)
    /** Normalize to forward slashes for cross-platform glob matching. */
    const rel = relative(basePath, resolved).replace(/\\/g, '/')

    /** Prevent path traversal outside basePath. */
    if (rel.startsWith('..')) {
        return false
    }

    /** Check denied paths first. */
    if (deniedPaths) {
        for (const pattern of deniedPaths) {
            if (matchGlob(rel, pattern)) return false
        }
    }

    /** If an allow-list is specified the path must match at least one entry. */
    if (allowedPaths && allowedPaths.length > 0) {
        return allowedPaths.some((pattern) => matchGlob(rel, pattern))
    }

    return true
}

/**
 * Tests whether a forward-slash-normalized path matches a glob pattern.
 *
 * Supported glob syntax:
 * - `*` matches any sequence of characters except `/`.
 * - `?` matches a single character except `/`.
 * - `**` matches zero or more path segments (also as prefix or suffix).
 *
 * @internal
 * @param path - Normalized (forward-slash) relative path.
 * @param pattern - Glob pattern to test against.
 * @returns `true` if the path matches the pattern.
 */
function matchGlob(path: string, pattern: string): boolean {
    /** Use placeholders to avoid replacing parts of our own regex. */
    const GLOBSTAR_PREFIX = '\x00GP\x00'
    const GLOBSTAR_SUFFIX = '\x00GS\x00'
    const GLOBSTAR = '\x00G\x00'
    const STAR = '\x00S\x00'
    const QUESTION = '\x00Q\x00'

    /** Tokenize glob patterns before escaping. */
    let s = pattern
    s = s.replace(/\*\*\//g, GLOBSTAR_PREFIX)
    s = s.replace(/\/\*\*/g, GLOBSTAR_SUFFIX)
    s = s.replace(/\*\*/g, GLOBSTAR)
    s = s.replace(/\*/g, STAR)
    s = s.replace(/\?/g, QUESTION)

    /** Escape regex special characters. */
    s = s.replace(/[.+^${}()|[\]\\]/g, '\\$&')

    /** Replace placeholders with their regex equivalents. */
    s = s.replace(new RegExp(escapeForRegex(GLOBSTAR_PREFIX), 'g'), '(.*/)?')
    s = s.replace(new RegExp(escapeForRegex(GLOBSTAR_SUFFIX), 'g'), '(/.*)?')
    s = s.replace(new RegExp(escapeForRegex(GLOBSTAR), 'g'), '.*')
    s = s.replace(new RegExp(escapeForRegex(STAR), 'g'), '[^/]*')
    s = s.replace(new RegExp(escapeForRegex(QUESTION), 'g'), '[^/]')

    return new RegExp(`^${s}$`).test(path)
}

/**
 * Escapes a string so it can be safely embedded in a `RegExp` constructor.
 *
 * @internal
 * @param s - The raw string to escape.
 * @returns The escaped string.
 */
function escapeForRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Checks whether a URL is permitted given optional allow/deny regex lists.
 *
 * Evaluation order:
 * 1. If the URL matches any `deniedUrls` pattern it is denied.
 * 2. If `allowedUrls` is provided and non-empty, the URL must match at
 *    least one pattern.
 * 3. Otherwise the URL is allowed.
 *
 * @param url - The URL string to validate.
 * @param allowedUrls - Optional regex patterns that explicitly allow access.
 * @param deniedUrls - Optional regex patterns that explicitly deny access.
 * @returns `true` if the URL is permitted, `false` otherwise.
 *
 * @example
 * ```ts
 * isUrlAllowed('https://api.example.com/data', [/^https:\/\/api\.example\.com/])
 * // true
 * ```
 */
export function isUrlAllowed(url: string, allowedUrls?: RegExp[], deniedUrls?: RegExp[]): boolean {
    if (deniedUrls) {
        for (const pattern of deniedUrls) {
            if (pattern.test(url)) return false
        }
    }

    if (allowedUrls && allowedUrls.length > 0) {
        return allowedUrls.some((pattern) => pattern.test(url))
    }

    return true
}

/**
 * Checks whether a shell command is permitted given optional allow/deny
 * regex lists.
 *
 * When no `deniedCommands` list is provided, a sensible default deny list
 * is used that blocks destructive operations such as `rm -rf /`, `sudo`,
 * `shutdown`, and `reboot`.
 *
 * @param command - The shell command string to validate.
 * @param allowedCommands - Optional regex patterns that explicitly allow
 *                          execution.
 * @param deniedCommands - Optional regex patterns that explicitly deny
 *                         execution. Overrides the built-in defaults when
 *                         provided.
 * @returns `true` if the command is permitted, `false` otherwise.
 *
 * @example
 * ```ts
 * isCommandAllowed('ls -la')         // true
 * isCommandAllowed('sudo rm -rf /') // false (matches default deny list)
 * ```
 */
export function isCommandAllowed(
    command: string,
    allowedCommands?: RegExp[],
    deniedCommands?: RegExp[],
): boolean {
    const defaultDenied = [/rm\s+-rf\s+\//, /sudo/, /shutdown/, /reboot/]
    const denied = deniedCommands ?? defaultDenied

    for (const pattern of denied) {
        if (pattern.test(command)) return false
    }

    if (allowedCommands && allowedCommands.length > 0) {
        return allowedCommands.some((pattern) => pattern.test(command))
    }

    return true
}
