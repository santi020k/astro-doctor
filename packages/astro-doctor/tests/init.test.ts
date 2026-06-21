import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { runInit } from '../src/init.js'

describe('runInit', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-init-test-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('creates starter files with the requested preset', () => {
    const result = runInit(['--preset', 'ci'], testDirectory)

    expect(result.created).toContain('doctor.config.ts')
    expect(result.created).toContain('eslint.config.js')
    expect(result.created).toContain('.github/workflows/astro-doctor.yml')
    expect(readFileSync(join(testDirectory, 'doctor.config.ts'), 'utf8')).toContain("preset: 'ci'")
  })

  test('does not overwrite existing files', () => {
    const eslintConfigPath = join(testDirectory, 'eslint.config.js')

    mkdirSync(testDirectory, { recursive: true })
    rmSync(eslintConfigPath, { force: true })
    runInit([], testDirectory)
    const firstConfig = readFileSync(eslintConfigPath, 'utf8')

    runInit([], testDirectory)

    expect(readFileSync(eslintConfigPath, 'utf8')).toBe(firstConfig)
    expect(existsSync(join(testDirectory, '.github/workflows/astro-doctor.yml'))).toBe(true)
  })
})
