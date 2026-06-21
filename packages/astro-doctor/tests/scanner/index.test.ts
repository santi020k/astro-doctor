import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { scan } from '../../src/scanner/index.js'

describe('scan', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-scan-test-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('returns a ScanResult with zero diagnostics for an empty project', async () => {
    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics).toEqual([])
    expect(scanResult.fileCount).toBe(0)
    expect(scanResult.errorCount).toBe(0)
    expect(scanResult.warningCount).toBe(0)
    expect(scanResult.score).toBe(100)
    expect(scanResult.scoreLabel).toBe('A')
  })

  test('returns a ScanResult with zero diagnostics for a clean Astro file', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      [
        '---',
        "import { Image } from 'astro:assets'",
        "import hero from '../assets/hero.png'",
        '---',
        '<Image src={hero} alt="Hero" />',
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.fileCount).toBe(1)
    expect(scanResult.errorCount).toBe(0)
  })

  test('detects a raw <img> tag and returns a diagnostic', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      '---\n---\n<img src="/hero.png" alt="hero" />'
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics.length).toBeGreaterThan(0)

    const useAstroImageDiagnostic = scanResult.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === 'astro-doctor/use-astro-image'
    )
    expect(useAstroImageDiagnostic).toBeDefined()
  })

  test('detects client:load overuse', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      [
        '---',
        "import Counter from './Counter.tsx'",
        '---',
        '<Counter client:load />',
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })

    const overuseDiagnostic = scanResult.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === 'astro-doctor/no-client-load-overuse'
    )
    expect(overuseDiagnostic).toBeDefined()
    expect(overuseDiagnostic?.severity).toBe('warning')
  })

  test('detects missing alt on <img>', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      '---\n---\n<img src="/hero.png" />'
    )

    const scanResult = await scan({ directory: testDirectory })

    const altDiagnostic = scanResult.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === 'astro-doctor/no-missing-alt'
    )
    expect(altDiagnostic).toBeDefined()
    expect(altDiagnostic?.severity).toBe('error')
  })

  test('detects set:html usage', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      [
        '---',
        "const content = '<p>Hello</p>'",
        '---',
        '<div set:html={content} />',
      ].join('\n')
    )

    const scanResult = await scan({ directory: testDirectory })

    const setHtmlDiagnostic = scanResult.diagnostics.find(
      (diagnostic) => diagnostic.ruleId === 'astro-doctor/no-set-html'
    )
    expect(setHtmlDiagnostic).toBeDefined()
  })

  test('accumulates diagnostics across multiple files', async () => {
    writeFileSync(join(testDirectory, 'page-a.astro'), '---\n---\n<img src="/a.png" />')
    writeFileSync(join(testDirectory, 'page-b.astro'), '---\n---\n<img src="/b.png" />')

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.fileCount).toBe(2)
    expect(scanResult.diagnostics.length).toBeGreaterThanOrEqual(2)
  })

  test('scans only provided changed files', async () => {
    writeFileSync(join(testDirectory, 'changed.astro'), '---\n---\n<div>Clean</div>')
    writeFileSync(join(testDirectory, 'unchanged.astro'), '---\n---\n<img src="/hero.png" />')

    const scanResult = await scan({
      directory: testDirectory,
      files: ['changed.astro'],
    })

    expect(scanResult.fileCount).toBe(1)
    expect(scanResult.diagnostics).toEqual([])
  })

  test('exposes the file path on each diagnostic', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      '---\n---\n<img src="/hero.png" />'
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(scanResult.diagnostics.every((diagnostic) => Boolean(diagnostic.filePath))).toBe(true)
    expect(scanResult.diagnostics[0]?.filePath).toMatch(/index\.astro$/)
  })
})
