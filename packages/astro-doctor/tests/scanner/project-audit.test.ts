import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { getPresetRules } from '../../src/presets.js'
import { scan } from '../../src/scanner/index.js'

describe('project audits', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-project-audit-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('inherits pnpm configuration from the workspace root', async () => {
    const projectDirectory = join(testDirectory, 'apps', 'docs')

    mkdirSync(projectDirectory, { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ name: 'workspace', packageManager: 'pnpm@10.0.0' })
    )
    writeFileSync(join(testDirectory, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n')
    writeFileSync(join(testDirectory, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    writeFileSync(join(projectDirectory, 'package.json'), JSON.stringify({ name: 'docs' }))

    const scanResult = await scan({
      directory: projectDirectory,
      files: ['package.json'],
      rules: {
        'astro-doctor/prefer-pnpm': 'warn'
      }
    })

    expect(scanResult.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'astro-doctor/prefer-pnpm' })
      ])
    )
  })

  test('does not enforce pnpm unless prefer-pnpm is enabled', async () => {
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ name: 'npm-project', packageManager: 'npm@11.0.0' })
    )
    writeFileSync(join(testDirectory, 'package-lock.json'), '{}')

    const scanResult = await scan({
      directory: testDirectory,
      files: ['package.json', 'package-lock.json']
    })

    expect(scanResult.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'astro-doctor/prefer-pnpm' })
      ])
    )
  })

  test.each([
    { packageManager: 'npm@11.0.0', lockFileName: 'package-lock.json' },
    { packageManager: 'yarn@4.9.0', lockFileName: 'yarn.lock' },
    { packageManager: 'bun@1.2.0', lockFileName: 'bun.lock' }
  ])(
    'reports $packageManager when prefer-pnpm is enabled', async ({ packageManager, lockFileName }) => {
      writeFileSync(
        join(testDirectory, 'package.json'), JSON.stringify({ name: 'alternate-manager', packageManager })
      )
      writeFileSync(join(testDirectory, lockFileName), '')

      const scanResult = await scan({
        directory: testDirectory,
        files: ['package.json', lockFileName],
        rules: {
          'astro-doctor/prefer-pnpm': 'warn'
        }
      })

      expect(scanResult.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId: 'astro-doctor/prefer-pnpm' })
        ])
      )
    }
  )

  test.each([
    'package-lock.json',
    'npm-shrinkwrap.json',
    'yarn.lock',
    'bun.lock',
    'bun.lockb'
  ])('reports competing %s in a pnpm project', async lockFileName => {
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ name: 'pnpm-project', packageManager: 'pnpm@10.0.0' })
    )
    writeFileSync(join(testDirectory, lockFileName), '')

    const scanResult = await scan({
      directory: testDirectory,
      files: ['package.json', lockFileName],
      rules: {
        'astro-doctor/prefer-pnpm': 'warn'
      }
    })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'astro-doctor/prefer-pnpm' })
      ])
    )
  })

  test.each([
    'packages:\n  - apps/*\n',
    'packages:\n  - tools/*\n  - \'!tools/docs\'\n'
  ])('does not inherit pnpm for a package excluded by workspace globs', async workspaceConfig => {
    const projectDirectory = join(testDirectory, 'tools', 'docs')

    mkdirSync(projectDirectory, { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ name: 'workspace', packageManager: 'pnpm@10.0.0' })
    )
    writeFileSync(join(testDirectory, 'pnpm-workspace.yaml'), workspaceConfig)
    writeFileSync(join(projectDirectory, 'package.json'), JSON.stringify({ name: 'docs' }))

    const scanResult = await scan({
      directory: projectDirectory,
      files: ['package.json'],
      rules: {
        'astro-doctor/prefer-pnpm': 'warn'
      }
    })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'astro-doctor/prefer-pnpm' })
      ])
    )
  })

  test('reports actions without a top-level input schema', async () => {
    mkdirSync(join(testDirectory, 'src', 'actions'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'src', 'actions', 'index.ts'), [
        'import { defineAction } from \'astro:actions\'',
        'import { z } from \'astro:schema\'',
        '',
        'export const server = {',
        '  unsafe: defineAction({',
        '    handler: async (input) => ({ nested: { input: \'not a schema\' }, input }),',
        '  }),',
        '  safe: defineAction({',
        '    input: z.object({ name: z.string() }),',
        '    handler: async ({ name }) => ({ name }),',
        '  }),',
        '  logout: defineAction({',
        '    handler: async () => true,',
        '  }),',
        '  rawForm: defineAction({',
        '    accept: \'form\',',
        '    handler: async (formData) => formData.get("name"),',
        '  }),',
        '}'
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })
    const actionDiagnostics = scanResult.diagnostics.filter(
      diagnostic => diagnostic.ruleId === 'astro-doctor/require-action-input-schema'
    )

    expect(actionDiagnostics).toHaveLength(1)
    expect(actionDiagnostics[0]).toMatchObject({
      severity: 'warning',
      line: 5,
      category: 'security'
    })
  })

  test('audits a selected action file without scanning unchanged actions', async () => {
    mkdirSync(join(testDirectory, 'src', 'actions'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'src', 'actions', 'changed.ts'), 'import { defineAction as createAction } from \'astro:actions\'\nexport const changed = createAction({ handler: async (input) => input })'
    )
    writeFileSync(
      join(testDirectory, 'src', 'actions', 'unchanged.ts'), 'import { defineAction } from \'astro:actions\'\nexport const unchanged = defineAction({ handler: async (input) => input })'
    )

    const scanResult = await scan({
      directory: testDirectory,
      files: ['src/actions/changed.ts']
    })

    expect(scanResult.diagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'astro-doctor/require-action-input-schema',
        filePath: join(testDirectory, 'src', 'actions', 'changed.ts')
      })
    ])
  })

  test('reports explicit insecure session cookie overrides only inside session.cookie', async () => {
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'import { defineConfig } from \'astro/config\'',
        '',
        'export default defineConfig({',
        '  unrelated: { secure: false },',
        '  session: {',
        '    cookie: {',
        '      secure: false,',
        '      httpOnly: false,',
        '      sameSite: false,',
        '    },',
        '  },',
        '})'
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })
    const cookieDiagnostics = scanResult.diagnostics.filter(
      diagnostic => diagnostic.ruleId === 'astro-doctor/no-insecure-session-cookie'
    )

    expect(cookieDiagnostics).toHaveLength(3)
    expect(cookieDiagnostics.map(diagnostic => diagnostic.line)).toEqual([7, 8, 9])
  })

  test('accepts secure session cookie configuration', async () => {
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'import { defineConfig } from \'astro/config\'',
        '',
        'export default defineConfig({',
        '  session: {',
        '    cookie: { secure: true, httpOnly: true, sameSite: "lax" },',
        '  },',
        '})'
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/no-insecure-session-cookie'
      )
    ).toBe(false)
  })

  test('reports Astro 7 experimental flags that moved or were removed', async () => {
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'import { defineConfig, memoryCache } from \'astro/config\'',
        '',
        'export default defineConfig({',
        '  experimental: {',
        '    advancedRouting: true,',
        '    cache: { provider: memoryCache() },',
        '    logger: { level: \'info\' },',
        '    queuedRendering: true,',
        '    routeRules: {},',
        '    rustCompiler: true,',
        '  },',
        '})'
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })
    const migrationDiagnostics = scanResult.diagnostics.filter(
      diagnostic => diagnostic.ruleId === 'astro-doctor/no-legacy-astro-7-experimental-flags'
    )

    expect(migrationDiagnostics).toHaveLength(6)
    expect(migrationDiagnostics.map(diagnostic => diagnostic.line)).toEqual([5, 6, 7, 8, 9, 10])
    expect(migrationDiagnostics.map(diagnostic => diagnostic.message)).toEqual([
      expect.stringContaining('advancedRouting'),
      expect.stringContaining('top-level cache'),
      expect.stringContaining('top-level logger'),
      expect.stringContaining('queuedRendering'),
      expect.stringContaining('top-level routeRules'),
      expect.stringContaining('rustCompiler')
    ])
  })

  test('reports Astro 7 migration flags in a plain object config', async () => {
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), 'export default { "experimental": { "advancedRouting": true } }'
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/no-legacy-astro-7-experimental-flags'
        })
      ])
    )
  })

  test('audits unchanged migration files when only the Astro 7 dependency is selected', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), 'export default defineConfig({ experimental: { advancedRouting: true } })'
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({
      directory: testDirectory,
      files: ['package.json']
    })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/no-legacy-astro-7-experimental-flags'
        }),
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export'
        })
      ])
    )
  })

  test('resolves the Astro version from the default pnpm catalog', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: 'catalog:' } })
    )
    writeFileSync(join(testDirectory, 'pnpm-workspace.yaml'), 'catalog:\n  astro: ^7.3.5\n')
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export'
        })
      ])
    )
  })

  test('accepts stable Astro 7 configuration fields', async () => {
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'import { defineConfig, memoryCache } from \'astro/config\'',
        '',
        'export default defineConfig({',
        '  cache: { provider: memoryCache() },',
        '  fetchFile: \'handler\',',
        '  logger: { level: \'info\' },',
        '  routeRules: {},',
        '})'
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/no-legacy-astro-7-experimental-flags'
      )
    ).toBe(false)
  })

  test('reports an Astro 7 fetch entrypoint without a default export', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = async (url: string) => fetch(url).then(response => response.json())\n'
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export',
          filePath: join(testDirectory, 'src', 'fetch.ts'),
          line: 1,
          category: 'best-practices'
        })
      ])
    )
  })

  test('reports the explicitly configured default Astro 7 fetch entrypoint', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), 'export default defineConfig({ fetchFile: \'fetch\' })'
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export',
          filePath: join(testDirectory, 'src', 'fetch.ts')
        })
      ])
    )
  })

  test('reports a configured Astro 7 fetch entrypoint inside a custom source directory', async () => {
    mkdirSync(join(testDirectory, 'source', 'server'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'export default defineConfig({',
        '  srcDir: \'./source\',',
        '  fetchFile: \'server/handler\',',
        '})'
      ].join('\n')
    )
    writeFileSync(
      join(testDirectory, 'source', 'server', 'handler.mts'), 'export const fetchJson = () => null'
    )

    const scanResult = await scan({
      directory: testDirectory,
      files: ['source/server/handler.mts']
    })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export',
          filePath: join(testDirectory, 'source', 'server', 'handler.mts')
        })
      ])
    )
  })

  test.each([
    'export default { async fetch(request: Request) { return new Response(request.url) } }',
    'const app = { fetch: (request: Request) => new Response(request.url) }\nexport default app',
    'const app = { fetch: (request: Request) => new Response(request.url) }\nexport { app as default }',
    'const type = { fetch: (request: Request) => new Response(request.url) }\nexport { type as default }'
  ])('accepts an Astro 7 fetch entrypoint with a default export', async fetchFileContent => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), fetchFileContent)

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-fetch-default-export'
      )
    ).toBe(false)
  })

  test.each([
    'export type { Handler as default }',
    'export { type Handler as default }',
    'export default interface Handler { fetch(request: Request): Response }',
    'export default declare class Handler {}'
  ])('reports a type-only default export in an Astro 7 fetch entrypoint', async fetchFileContent => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), fetchFileContent)

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export'
        })
      ])
    )
  })

  test('accepts a disabled fetch entrypoint in a plain object config', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(join(testDirectory, 'astro.config.ts'), 'export default { "fetchFile": null }')
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-fetch-default-export'
      )
    ).toBe(false)
  })

  test('accepts a utility named src/fetch.ts when Astro routing entrypoints are disabled', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), 'import { defineConfig } from \'astro/config\'\nexport default defineConfig({ fetchFile: null })\n'
    )
    writeFileSync(
      join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = async (url: string) => fetch(url).then(response => response.json())\n'
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-fetch-default-export'
      )
    ).toBe(false)
  })

  test('accepts a disabled fetch entrypoint from an identifier-backed config', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'import { defineConfig } from \'astro/config\'',
        'const config = defineConfig({ fetchFile: null })',
        'export default config'
      ].join('\n')
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-fetch-default-export'
      )
    ).toBe(false)
  })

  test('does not assume a default fetch entrypoint for shorthand configuration', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'const fetchFile = null',
        'export default defineConfig({ fetchFile })'
      ].join('\n')
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-fetch-default-export'
      )
    ).toBe(false)
  })

  test('does not assume a default fetch entrypoint when configuration is spread', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'const options = { fetchFile: null }',
        'export default defineConfig({ ...options })'
      ].join('\n')
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-fetch-default-export'
      )
    ).toBe(false)
  })

  test('reports shorthand Astro 7 experimental flags', async () => {
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), [
        'const advancedRouting = true',
        'export default defineConfig({ experimental: { advancedRouting } })'
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/no-legacy-astro-7-experimental-flags'
        })
      ])
    )
  })

  test('reports a fetch entrypoint whose regex literal contains export syntax', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'src', 'fetch.ts'), 'export const exportPattern = /export default /u'
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export'
        })
      ])
    )
  })

  test('reports a fetch entrypoint whose regex contains an export boundary', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } })
    )
    writeFileSync(
      join(testDirectory, 'src', 'fetch.ts'), 'export const exportPattern = /} export default /'
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export'
        })
      ])
    )
  })

  test('does not apply Astro 7 migration audits to Astro 6 projects', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '^6.4.0' } })
    )
    writeFileSync(
      join(testDirectory, 'astro.config.ts'), 'export default defineConfig({ experimental: { advancedRouting: true } })'
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })
    const astro7MigrationRuleIds = [
      'astro-doctor/no-legacy-astro-7-experimental-flags',
      'astro-doctor/require-fetch-default-export'
    ]

    expect(
      scanResult.diagnostics.some(
        diagnostic => astro7MigrationRuleIds.includes(diagnostic.ruleId)
      )
    ).toBe(false)
  })

  test('does not apply Astro 7 migration audits to a bounded Astro 6 range', async () => {
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '>=6 <7' } })
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-fetch-default-export'
      )
    ).toBe(false)
  })

  test('uses the installed Astro version for a broad declared range', async () => {
    mkdirSync(join(testDirectory, 'node_modules', 'astro'), { recursive: true })
    mkdirSync(join(testDirectory, 'src'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'package.json'), JSON.stringify({ dependencies: { astro: '>=6' } })
    )
    writeFileSync(
      join(testDirectory, 'node_modules', 'astro', 'package.json'), JSON.stringify({ version: '7.3.5' })
    )
    writeFileSync(join(testDirectory, 'src', 'fetch.ts'), 'export const fetchJson = () => null')

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-fetch-default-export'
        })
      ])
    )
  })

  test('reports DOMContentLoaded usage in valid script-tag variants across a ClientRouter project', async () => {
    mkdirSync(join(testDirectory, 'src', 'components'), { recursive: true })
    mkdirSync(join(testDirectory, 'src', 'layouts'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'src', 'layouts', 'layout.astro'), [
        '---',
        'import { ClientRouter } from \'astro:transitions\'',
        '---',
        '<ClientRouter />',
        '<slot />'
      ].join('\n')
    )
    writeFileSync(
      join(testDirectory, 'src', 'components', 'menu.astro'), [
        '<button id="menu">Menu</button>',
        '<SCRIPT>',
        '  document.addEventListener(\'DOMContentLoaded\', () => {})',
        '</SCRIPT data-ignored>'
      ].join('\n')
    )

    const recommendedResult = await scan({ directory: testDirectory })
    const strictResult = await scan({
      directory: testDirectory,
      rules: getPresetRules('strict')
    })

    expect(
      recommendedResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-client-router-script-lifecycle'
      )
    ).toBe(false)
    expect(strictResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-client-router-script-lifecycle',
          filePath: join(testDirectory, 'src', 'components', 'menu.astro'),
          line: 3,
          severity: 'error',
          category: 'best-practices'
        })
      ])
    )
  })

  test('accepts astro:page-load initialization in a ClientRouter project', async () => {
    writeFileSync(
      join(testDirectory, 'layout.astro'), [
        '---',
        'import { ClientRouter } from \'astro:transitions\'',
        '---',
        '<ClientRouter />',
        '<script>',
        '  document.addEventListener(\'astro:page-load\', () => {})',
        '</script>'
      ].join('\n')
    )

    const scanResult = await scan({
      directory: testDirectory,
      rules: getPresetRules('strict')
    })

    expect(
      scanResult.diagnostics.some(
        diagnostic => diagnostic.ruleId === 'astro-doctor/require-client-router-script-lifecycle'
      )
    ).toBe(false)
  })
})
