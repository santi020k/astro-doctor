import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { aggregateResults, autoDiscoverAstroProjects, discoverWorkspacePackages, isAstroProject, resolveProjectDirectories } from '../src/multi-project.js'
import type { ProjectScanResult } from '../src/types.js'

describe('multi-project', () => {
  describe('aggregateResults', () => {
    test('returns perfect score for empty results', () => {
      const result = aggregateResults([])
      expect(result.score).toBe(100)
      expect(result.scoreLabel).toBe('S')
      expect(result.fileCount).toBe(0)
    })

    test('aggregates multiple results', () => {
      const results: ProjectScanResult[] = [
        {
          name: 'p1',
          directory: '/p1',
          diagnostics: [{
            ruleId: 'astro-doctor/no-set-html',
            message: 'err',
            severity: 'error',
            line: 1,
            column: 1,
            filePath: '/p1/a.astro',
            category: 'security'
          }],
          fileCount: 1,
          errorCount: 1,
          warningCount: 0,
          score: 80,
          scoreLabel: 'B',
          scoreBreakdown: { performance: 100, accessibility: 100, security: 0, 'best-practices': 100 }
        },
        {
          name: 'p2',
          directory: '/p2',
          diagnostics: [],
          fileCount: 1,
          errorCount: 0,
          warningCount: 0,
          score: 100,
          scoreLabel: 'S',
          scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 }
        }
      ]

      const agg = aggregateResults(results)
      expect(agg.fileCount).toBe(2)
      expect(agg.errorCount).toBe(1)
      expect(agg.diagnostics).toHaveLength(1)
      expect(agg.score).toBeLessThan(100)
    })
  })

  describe('resolveProjectDirectories', () => {
    test('handles unknown projects gracefully', async () => {
      const dirs = await resolveProjectDirectories(['does-not-exist'], process.cwd())
      expect(dirs).toHaveLength(0)
    })
  })
})

describe('discoverWorkspacePackages', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-ws-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('returns [] for empty directory (no workspace file)', async () => {
    const result = await discoverWorkspacePackages(testDirectory)
    expect(result).toEqual([])
  })

  test('discovers packages from pnpm-workspace.yaml with quoted globs', async () => {
    writeFileSync(
      join(testDirectory, 'pnpm-workspace.yaml'),
      `packages:\n  - 'apps/*'\n`,
    )
    const appsDir = join(testDirectory, 'apps', 'web')
    mkdirSync(appsDir, { recursive: true })
    writeFileSync(
      join(appsDir, 'package.json'),
      JSON.stringify({ name: 'web-app' }),
    )

    const result = await discoverWorkspacePackages(testDirectory)
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((pkg) => pkg.name === 'web-app')).toBe(true)
  })

  test('discovers packages from package.json workspaces array', async () => {
    writeFileSync(
      join(testDirectory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    )
    const pkgDir = join(testDirectory, 'packages', 'ui')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'ui-package' }),
    )

    const result = await discoverWorkspacePackages(testDirectory)
    expect(result.some((pkg) => pkg.name === 'ui-package')).toBe(true)
  })

  test('discovers packages from package.json workspaces object { packages: [...] }', async () => {
    writeFileSync(
      join(testDirectory, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: { packages: ['packages/*'] } }),
    )
    const pkgDir = join(testDirectory, 'packages', 'core')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'core-package' }),
    )

    const result = await discoverWorkspacePackages(testDirectory)
    expect(result.some((pkg) => pkg.name === 'core-package')).toBe(true)
  })
})

describe('isAstroProject', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-is-astro-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('returns false for empty directory', () => {
    expect(isAstroProject(testDirectory)).toBe(false)
  })

  test('returns true when astro.config.mjs exists', () => {
    writeFileSync(join(testDirectory, 'astro.config.mjs'), "export default {}")
    expect(isAstroProject(testDirectory)).toBe(true)
  })

  test('returns true when astro.config.ts exists', () => {
    writeFileSync(join(testDirectory, 'astro.config.ts'), "export default {}")
    expect(isAstroProject(testDirectory)).toBe(true)
  })

  test('returns true when package.json has astro in dependencies', () => {
    writeFileSync(
      join(testDirectory, 'package.json'),
      JSON.stringify({ dependencies: { astro: '^4.0.0' } }),
    )
    expect(isAstroProject(testDirectory)).toBe(true)
  })

  test('returns true when package.json has astro in devDependencies', () => {
    writeFileSync(
      join(testDirectory, 'package.json'),
      JSON.stringify({ devDependencies: { astro: '^4.0.0' } }),
    )
    expect(isAstroProject(testDirectory)).toBe(true)
  })

  test('returns false when package.json has no astro dep and no astro config', () => {
    writeFileSync(
      join(testDirectory, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
    )
    expect(isAstroProject(testDirectory)).toBe(false)
  })

  test('returns false for non-existent directory', () => {
    expect(isAstroProject(join(testDirectory, 'does-not-exist'))).toBe(false)
  })
})

describe('autoDiscoverAstroProjects', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-auto-discover-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('returns only Astro projects from workspace packages', async () => {
    // Set up pnpm workspace with two packages: one Astro, one not
    writeFileSync(
      join(testDirectory, 'pnpm-workspace.yaml'),
      `packages:\n  - 'apps/*'\n`,
    )

    // Astro project
    const astroDir = join(testDirectory, 'apps', 'site')
    mkdirSync(astroDir, { recursive: true })
    writeFileSync(join(astroDir, 'package.json'), JSON.stringify({ name: 'site' }))
    writeFileSync(join(astroDir, 'astro.config.mjs'), "export default {}")

    // Non-Astro project
    const otherDir = join(testDirectory, 'apps', 'api')
    mkdirSync(otherDir, { recursive: true })
    writeFileSync(join(otherDir, 'package.json'), JSON.stringify({ name: 'api', dependencies: { express: '^4.0.0' } }))

    const result = await autoDiscoverAstroProjects(testDirectory)
    expect(result.some((pkg) => pkg.name === 'site')).toBe(true)
    expect(result.some((pkg) => pkg.name === 'api')).toBe(false)
  })
})
