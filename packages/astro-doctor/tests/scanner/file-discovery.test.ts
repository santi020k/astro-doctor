import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverAstroFiles } from '../../src/scanner/file-discovery.js'

describe('discoverAstroFiles', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-test-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  it('returns empty array when no .astro files exist', async () => {
    const discoveredFiles = await discoverAstroFiles(testDirectory)
    expect(discoveredFiles).toEqual([])
  })

  it('discovers .astro files in the root directory', async () => {
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')
    writeFileSync(join(testDirectory, 'about.astro'), '---\n---\n<h1>About</h1>')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(2)
    expect(discoveredFiles.some((filePath) => filePath.endsWith('index.astro'))).toBe(true)
    expect(discoveredFiles.some((filePath) => filePath.endsWith('about.astro'))).toBe(true)
  })

  it('discovers .astro files recursively in subdirectories', async () => {
    mkdirSync(join(testDirectory, 'pages'), { recursive: true })
    mkdirSync(join(testDirectory, 'components'), { recursive: true })

    writeFileSync(join(testDirectory, 'pages', 'index.astro'), '---\n---\n<h1>Home</h1>')
    writeFileSync(join(testDirectory, 'components', 'Header.astro'), '---\n---\n<header />')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(2)
  })

  it('ignores non-.astro files', async () => {
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')
    writeFileSync(join(testDirectory, 'utils.ts'), 'export const add = (a: number, b: number) => a + b')
    writeFileSync(join(testDirectory, 'styles.css'), 'body { margin: 0 }')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(1)
    expect(discoveredFiles[0]).toMatch(/index\.astro$/)
  })

  it('ignores node_modules directory', async () => {
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

  it('ignores dist directory', async () => {
    mkdirSync(join(testDirectory, 'dist'), { recursive: true })
    writeFileSync(join(testDirectory, 'dist', 'index.astro'), '---\n---\n<div />')
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles).toHaveLength(1)
    expect(discoveredFiles.some((filePath) => filePath.includes('/dist/'))).toBe(false)
  })

  it('returns absolute paths', async () => {
    writeFileSync(join(testDirectory, 'index.astro'), '---\n---\n<h1>Hello</h1>')

    const discoveredFiles = await discoverAstroFiles(testDirectory)

    expect(discoveredFiles.every((filePath) => filePath.startsWith('/'))).toBe(true)
  })
})
