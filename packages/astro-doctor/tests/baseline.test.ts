import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  createPersistentBaseline,
  filterIntroducedDiagnostics,
  filterPersistentBaselineDiagnostics,
  readPersistentBaseline,
  scanBaseline,
  writePersistentBaseline,
} from '../src/baseline.js'
import { resolveBaseRevision } from '../src/git.js'
import { scan } from '../src/scanner/index.js'

const ARCHIVE_REGRESSION_FILE_SIZE_BYTES = 2 * 1024 * 1024

describe('baseline comparison', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-baseline-test-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
    execFileSync('git', ['init'], { cwd: testDirectory })
    execFileSync('git', ['config', 'user.email', 'astro-doctor@example.com'], {
      cwd: testDirectory,
    })
    execFileSync('git', ['config', 'user.name', 'Astro Doctor'], {
      cwd: testDirectory,
    })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('reports only diagnostics introduced after the base revision', async () => {
    const astroFilePath = join(testDirectory, 'index.astro')

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" alt="Hero" />')
    execFileSync('git', ['add', 'index.astro'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: testDirectory })

    const baseRevision = resolveBaseRevision(testDirectory, 'HEAD')

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')

    const currentResult = await scan({
      directory: testDirectory,
      files: [astroFilePath],
    })
    const baseline = await scanBaseline({
      repositoryDirectory: testDirectory,
      projectDirectory: testDirectory,
      files: [astroFilePath],
      baseRevision,
      scanOptions: {},
    })
    const introducedResult = filterIntroducedDiagnostics(
      currentResult,
      baseline.result,
      testDirectory,
      baseline.rootDirectory,
    )

    expect(introducedResult.diagnostics).toHaveLength(1)
    expect(introducedResult.diagnostics[0]?.ruleId).toBe('astro-doctor/no-missing-alt')
  })

  test('preserves unchanged project context when scanning a changed-file baseline', async () => {
    const layoutFilePath = join(testDirectory, 'layout.astro')
    const componentFilePath = join(testDirectory, 'component.astro')
    const lifecycleRules: Record<string, 'warn'> = {
      'astro-doctor/require-client-router-script-lifecycle': 'warn',
    }

    writeFileSync(
      layoutFilePath,
      "---\nimport { ClientRouter } from 'astro:transitions'\n---\n<ClientRouter />",
    )
    writeFileSync(
      componentFilePath,
      "<script>document.addEventListener('DOMContentLoaded', () => {})</script>",
    )
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: testDirectory })

    const baseRevision = resolveBaseRevision(testDirectory, 'HEAD')

    writeFileSync(
      componentFilePath,
      "<script>document.addEventListener('DOMContentLoaded', () => {})</script>\n",
    )

    const currentResult = await scan({
      directory: testDirectory,
      files: [componentFilePath],
      rules: lifecycleRules,
    })
    const baseline = await scanBaseline({
      repositoryDirectory: testDirectory,
      projectDirectory: testDirectory,
      files: [componentFilePath],
      baseRevision,
      scanOptions: {
        rules: lifecycleRules,
      },
    })
    const introducedResult = filterIntroducedDiagnostics(
      currentResult,
      baseline.result,
      testDirectory,
      baseline.rootDirectory,
    )

    expect(currentResult.diagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'astro-doctor/require-client-router-script-lifecycle',
      }),
    ])
    expect(introducedResult.diagnostics).toEqual([])
  })

  test('scans a baseline when the repository archive exceeds the child process buffer', async () => {
    const astroFilePath = join(testDirectory, 'index.astro')
    const largeFilePath = join(testDirectory, 'large.bin')

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" alt="Hero" />')
    writeFileSync(largeFilePath, Buffer.alloc(ARCHIVE_REGRESSION_FILE_SIZE_BYTES))
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'large baseline'], { cwd: testDirectory })

    const baseRevision = resolveBaseRevision(testDirectory, 'HEAD')
    const baseline = await scanBaseline({
      repositoryDirectory: testDirectory,
      projectDirectory: testDirectory,
      files: [astroFilePath],
      baseRevision,
      scanOptions: {},
    })

    expect(baseline.result.fileCount).toBe(1)
  })

  test('writes and applies a persistent baseline', async () => {
    const astroFilePath = join(testDirectory, 'index.astro')
    const baselineFilePath = join(testDirectory, '.astro-doctor-baseline.json')

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')

    const initialResult = await scan({ directory: testDirectory })
    const baseline = createPersistentBaseline(initialResult, testDirectory)

    writePersistentBaseline(baselineFilePath, baseline)

    const loadedBaseline = readPersistentBaseline(baselineFilePath)
    const filteredResult = filterPersistentBaselineDiagnostics(
      initialResult,
      loadedBaseline,
      testDirectory,
    )

    expect(loadedBaseline.version).toBe(1)
    expect(filteredResult.diagnostics).toEqual([])
    expect(filteredResult.score).toBe(100)
  })

  test('keeps findings introduced after a persistent baseline was created', async () => {
    const astroFilePath = join(testDirectory, 'index.astro')

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" alt="Hero" />')

    const initialResult = await scan({ directory: testDirectory })
    const baseline = createPersistentBaseline(initialResult, testDirectory)

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')

    const currentResult = await scan({ directory: testDirectory })
    const filteredResult = filterPersistentBaselineDiagnostics(
      currentResult,
      baseline,
      testDirectory,
    )

    expect(filteredResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'astro-doctor/no-missing-alt' }),
      ]),
    )
  })

  test('rejects an unsupported persistent baseline version', () => {
    const baselineFilePath = join(testDirectory, '.astro-doctor-baseline.json')

    writeFileSync(baselineFilePath, JSON.stringify({
      version: 999,
      generatedAt: new Date().toISOString(),
      entries: [],
    }))

    expect(() => readPersistentBaseline(baselineFilePath)).toThrow(
      'Unsupported baseline version',
    )
  })
})
