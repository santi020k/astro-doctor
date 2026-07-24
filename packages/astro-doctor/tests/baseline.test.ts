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
