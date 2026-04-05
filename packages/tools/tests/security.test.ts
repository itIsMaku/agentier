import { describe, it, expect } from 'bun:test'
import { isPathAllowed, isUrlAllowed, isCommandAllowed } from '../src/utils/security'

describe('isPathAllowed', () => {
    it('should block path traversal', () => {
        expect(isPathAllowed('../../../etc/passwd', '/home/user')).toBe(false)
        expect(isPathAllowed('../../secret', '/home/user/project')).toBe(false)
    })

    it('should allow paths within basePath', () => {
        expect(isPathAllowed('src/index.ts', '/home/user/project')).toBe(true)
        expect(isPathAllowed('./readme.md', '/home/user/project')).toBe(true)
    })

    it('should respect denied paths', () => {
        expect(
            isPathAllowed('node_modules/pkg/index.js', '/home/user', undefined, [
                '**/node_modules/**',
            ]),
        ).toBe(false)
        expect(isPathAllowed('.env.local', '/home/user', undefined, ['**/.env*'])).toBe(false)
    })

    it('should respect allowed paths', () => {
        expect(isPathAllowed('src/foo.ts', '/home/user', ['src/**'])).toBe(true)
        expect(isPathAllowed('lib/foo.ts', '/home/user', ['src/**'])).toBe(false)
    })
})

describe('isUrlAllowed', () => {
    it('should allow all URLs by default', () => {
        expect(isUrlAllowed('https://example.com')).toBe(true)
    })

    it('should block denied URLs', () => {
        expect(isUrlAllowed('https://evil.com', undefined, [/evil\.com/])).toBe(false)
    })

    it('should only allow specified URLs', () => {
        expect(isUrlAllowed('https://api.example.com', [/example\.com/])).toBe(true)
        expect(isUrlAllowed('https://other.com', [/example\.com/])).toBe(false)
    })
})

describe('isCommandAllowed', () => {
    it('should block dangerous commands by default', () => {
        expect(isCommandAllowed('rm -rf /')).toBe(false)
        expect(isCommandAllowed('sudo apt install')).toBe(false)
    })

    it('should allow safe commands', () => {
        expect(isCommandAllowed('ls -la')).toBe(true)
        expect(isCommandAllowed('echo hello')).toBe(true)
    })

    it('should respect custom allowed commands', () => {
        expect(isCommandAllowed('git status', [/^git /])).toBe(true)
        expect(isCommandAllowed('npm install', [/^git /])).toBe(false)
    })
})
