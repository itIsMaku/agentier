import { execSync } from 'child_process'
import { join } from 'path'

const root = join(import.meta.dirname, '..')

const CORE = 'packages/core'
const PACKAGES = [
    'packages/provider-openai',
    'packages/provider-anthropic',
    'packages/provider-google',
    'packages/middleware',
    'packages/memory',
    'packages/tools',
]

function buildPackage(pkg: string) {
    const dir = join(root, pkg)
    console.log(`Building ${pkg}...`)
    execSync('bun build ./src/index.ts --outdir ./dist --target node', {
        cwd: dir,
        stdio: 'inherit',
    })
    execSync('bunx tsc -p tsconfig.build.json', { cwd: dir, stdio: 'inherit' })
}

// Core first — other packages reference its .d.ts output
buildPackage(CORE)

// Then the rest
for (const pkg of PACKAGES) {
    buildPackage(pkg)
}

console.log('All packages built successfully.')
