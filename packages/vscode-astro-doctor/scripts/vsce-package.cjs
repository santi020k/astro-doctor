/**
 * Resolves pnpm catalog: references in package.json before running vsce package,
 * then restores the original file. This lets us keep catalog: in source while
 * satisfying vsce's semver validation of @types/vscode.
 */

'use strict'

const { execSync } = require('node:child_process')
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const PKG_PATH = resolve(__dirname, '../package.json')
const WORKSPACE_PATH = resolve(__dirname, '../../../pnpm-workspace.yaml')

const originalContent = readFileSync(PKG_PATH, 'utf8')
const workspace = readFileSync(WORKSPACE_PATH, 'utf8')
const pkg = JSON.parse(originalContent)

const resolveCatalogVersion = (packageName) => {
  const escaped = packageName.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')
  // YAML keys may be quoted ("@types/vscode") or unquoted (glob)
  const match = workspace.match(new RegExp(`["']?${escaped}["']?:\\s*([^\\n]+)`))
  return match?.[1]?.trim() ?? null
}

for (const section of ['dependencies', 'devDependencies']) {
  const deps = pkg[section]
  if (!deps) continue

  for (const [name, value] of Object.entries(deps)) {
    if (value === 'catalog:') {
      const resolved = resolveCatalogVersion(name)
      if (resolved) deps[name] = resolved
    }
  }
}

try {
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n')
  execSync('npx --yes @vscode/vsce package --no-dependencies -o astro-doctor.vsix', {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
  })
} finally {
  writeFileSync(PKG_PATH, originalContent)
}
