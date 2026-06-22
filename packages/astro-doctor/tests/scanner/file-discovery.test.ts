import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, sep } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { discoverAstroFiles, resolveAstroFiles } from '../../src/scanner/file-discovery.js'

describe('discoverAstroFiles', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-test-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('returns empty array when no .astro files exist', async () => {
    const discoveredFiles = await discoverAstroFiles(testDirectory)
    expect(discoveredFiles).toEqual([])
  })

  test('discovers .astro files in the root directory', async () => {
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')
    writeFileSync(join(testDirectory, 'about.astro'), '---\n---\n<h1>About</h1>')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(2)
    expect(discoveredFiles.some((filePath) => filePath.endsWith('index.astro'))).toBe(true)
    expect(discoveredFiles.some((filePath) => filePath.endsWith('about.astro'))).toBe(true)
  })

  test('discovers .astro files recursively in subdirectories', async () => {
    mkdirSync(join(testDirectory, 'pages'), { recursive: true })
    mkdirSync(join(testDirectory, 'components'), { recursive: true })

    writeFileSync(join(testDirectory, 'pages', 'index.astro'), '---\n---\n<h1>Home</h1>')
    writeFileSync(join(testDirectory, 'components', 'Header.astro'), '---\n---\n<header />')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(2)
  })

  test('ignores non-.astro files', async () => {
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')
    writeFileSync(join(testDirectory, 'utils.ts'), 'export const add = (a: number, b: number) => a + b')
    writeFileSync(join(testDirectory, 'styles.css'), 'body { margin: 0 }')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(1)
    expect(discoveredFiles[0]).toMatch(/index\.astro$/)
  })

  test('ignores node_modules directory', async () => {
    mkdirSync(join(testDirectory, 'node_modules', 'some-pkg'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'node_modules', 'some-pkg', 'component.astro'),
      '---\n---\n<div />'
    )
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(1)
    expect(discoveredFiles.some((filePath) => filePath.includes('node_modules'))).toBe(false)
  })

  test('ignores dist directory', async () => {
    mkdirSync(join(testDirectory, 'dist'), { recursive: true })
    writeFileSync(join(testDirectory, 'dist', 'index.astro'), '---\n---\n<div />')
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(1)
    expect(discoveredFiles.some((filePath) => filePath.includes(`${sep}dist${sep}`))).toBe(false)
  })

  test('returns absolute paths', async () => {
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles.every((filePath) => isAbsolute(filePath))).toBe(true)
  })

  test('resolves existing changed Astro files', () => {
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')
    writeFileSync(join(testDirectory, 'utils.ts'), 'export const value = 1')

    const resolvedFiles = resolveAstroFiles(testDirectory, [
      'index.astro',
      'utils.ts',
      'missing.astro',
    ])

    expect(resolvedFiles).toEqual([join(testDirectory, 'index.astro')])
  })
})
