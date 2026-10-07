import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { runInstall } from '../src/install.js'

const REAL_SKILL_CONTENT = readFileSync(
  resolve(import.meta.dirname, '../../../skills/SKILL.md'), 'utf8'
)

describe('runInstall', () => {
  let testDirectory: string
  const originalExitCode = process.exitCode

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-install-test-'))
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    vi.spyOn(console, 'warn').mockImplementation(vi.fn())
    vi.spyOn(console, 'error').mockImplementation(vi.fn())
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(testDirectory, { recursive: true, force: true })
    process.exitCode = originalExitCode
  })

  test('installs the real skill content from the single source of truth', async () => {
    await runInstall(['-y'], testDirectory)

    const installedContent = readFileSync(join(testDirectory, 'skills/astro-doctor.md'), 'utf8')

    expect(installedContent).toBe(REAL_SKILL_CONTENT)
    expect(process.exitCode).toBeUndefined()
  })

  test('installs native agent hooks with the same skill content when requested', async () => {
    await runInstall(['-y', '--agent-hooks'], testDirectory)

    expect(readFileSync(join(testDirectory, '.claude/skills/astro-doctor.md'), 'utf8'))
      .toBe(REAL_SKILL_CONTENT)
    expect(readFileSync(join(testDirectory, '.cursor/rules/astro-doctor.mdc'), 'utf8'))
      .toBe(REAL_SKILL_CONTENT)
    expect(process.exitCode).toBeUndefined()
  })

  test('creates a GitHub Actions workflow that grants contents:read alongside pull-requests:write', async () => {
    await runInstall(['-y'], testDirectory)

    const workflow = readFileSync(join(testDirectory, '.github/workflows/astro-doctor.yml'), 'utf8')

    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('pull-requests: write')
    expect(workflow).not.toContain('paths:')
    expect(workflow).not.toContain('github-token:')
    expect(process.exitCode).toBeUndefined()
  })

  test('does not overwrite an existing GitHub Actions workflow', async () => {
    const workflowDirectory = join(testDirectory, '.github/workflows')
    const workflowPath = join(workflowDirectory, 'astro-doctor.yml')

    mkdirSync(workflowDirectory, { recursive: true })
    writeFileSync(workflowPath, 'custom: true\n', 'utf8')

    await runInstall(['-y'], testDirectory)

    expect(readFileSync(workflowPath, 'utf8')).toBe('custom: true\n')
  })

  test('dry run reports planned installs without writing to disk', async () => {
    await runInstall(['-y', '--dry-run', '--agent-hooks'], testDirectory)

    expect(existsSync(join(testDirectory, 'skills'))).toBe(false)
    expect(existsSync(join(testDirectory, '.claude'))).toBe(false)
    expect(existsSync(join(testDirectory, '.cursor'))).toBe(false)
    expect(existsSync(join(testDirectory, '.github'))).toBe(false)
    expect(process.exitCode).toBeUndefined()
  })

  test('reports failure and sets a nonzero exit code when a skill destination cannot be written', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    writeFileSync(join(testDirectory, 'skills'), 'blocking file, not a directory', 'utf8')

    await runInstall(['-y'], testDirectory)

    expect(process.exitCode).toBe(1)
    expect(consoleError).toHaveBeenCalled()
    expect(consoleLog.mock.calls.flat().join('\n')).not.toContain('Done!')
  })
})
