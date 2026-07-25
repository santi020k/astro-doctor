import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { runCli } from '../src/cli.js'
import type { JsonReport } from '../src/types.js'

describe('runCli', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-cli-test-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
    execFileSync('git', ['init'], { cwd: testDirectory })
    execFileSync('git', ['config', 'user.email', 'astro-doctor@example.com'], {
      cwd: testDirectory,
    })
    execFileSync('git', ['config', 'user.name', 'Astro Doctor'], {
      cwd: testDirectory,
    })
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(testDirectory, { recursive: true, force: true })
    process.exitCode = undefined
  })

  test('changed scope emits only diagnostics introduced since the base', async () => {
    const astroFilePath = join(testDirectory, 'index.astro')

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" alt="Hero" />')
    execFileSync('git', ['add', 'index.astro'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: testDirectory })
    const baseRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: testDirectory,
      encoding: 'utf8',
    }).trim()

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')
    execFileSync('git', ['add', 'index.astro'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'change'], { cwd: testDirectory })

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      '--dir',
      testDirectory,
      '--scope',
      'changed',
      '--base',
      baseRevision,
      '--json',
      '--fail-on',
      'off',
    ])

    const report = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as JsonReport

    expect(report.scope).toBe('changed')
    expect(report.diagnostics).toHaveLength(1)
    expect(report.diagnostics[0]?.ruleId).toBe('astro-doctor/no-missing-alt')
  })

  test('changed scope filters introduced diagnostics in discovered workspace projects', async () => {
    const projectDirectory = join(testDirectory, 'apps', 'site')
    const astroFilePath = join(projectDirectory, 'index.astro')

    mkdirSync(projectDirectory, { recursive: true })
    writeFileSync(join(testDirectory, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
    writeFileSync(
      join(projectDirectory, 'package.json'),
      JSON.stringify({ name: 'site', dependencies: { astro: '^7.0.0' } }),
    )
    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" alt="Hero" />')
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: testDirectory })

    const baseRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: testDirectory,
      encoding: 'utf8',
    }).trim()

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'change'], { cwd: testDirectory })

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      '--dir',
      testDirectory,
      '--scope',
      'changed',
      '--base',
      baseRevision,
      '--json',
      '--fail-on',
      'off',
    ])

    const report = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as JsonReport

    expect(report.projects).toHaveLength(1)
    expect(report.diagnostics).toHaveLength(1)
    expect(report.diagnostics[0]?.ruleId).toBe('astro-doctor/no-missing-alt')
  })

  test('changed scope applies overrides to the baseline scan', async () => {
    const astroFilePath = join(testDirectory, 'index.astro')

    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({
        overrides: [{
          files: ['index.astro'],
          rules: {
            'astro-doctor/no-missing-alt': 'error',
          },
        }],
      }),
    )
    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: testDirectory })

    const baseRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: testDirectory,
      encoding: 'utf8',
    }).trim()

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />\n')
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'change'], { cwd: testDirectory })

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      '--dir',
      testDirectory,
      '--scope',
      'changed',
      '--base',
      baseRevision,
      '--json',
      '--fail-on',
      'off',
    ])

    const report = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as JsonReport

    expect(report.diagnostics).toEqual([])
  })

  test('changed scope applies overrides to workspace project baseline scans', async () => {
    const projectDirectory = join(testDirectory, 'apps', 'site')
    const astroFilePath = join(projectDirectory, 'index.astro')

    mkdirSync(projectDirectory, { recursive: true })
    writeFileSync(join(testDirectory, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({
        overrides: [{
          files: ['index.astro'],
          rules: {
            'astro-doctor/no-missing-alt': 'error',
          },
        }],
      }),
    )
    writeFileSync(
      join(projectDirectory, 'package.json'),
      JSON.stringify({ name: 'site', dependencies: { astro: '^7.0.0' } }),
    )
    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: testDirectory })

    const baseRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: testDirectory,
      encoding: 'utf8',
    }).trim()

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />\n')
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'change'], { cwd: testDirectory })

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      '--dir',
      testDirectory,
      '--scope',
      'changed',
      '--base',
      baseRevision,
      '--json',
      '--fail-on',
      'off',
    ])

    const report = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as JsonReport

    expect(report.diagnostics).toEqual([])
  })

  test('uses an explicit changed-files manifest instead of a Git diff', async () => {
    const selectedFilePath = join(testDirectory, 'selected.astro')
    const ignoredFilePath = join(testDirectory, 'ignored.astro')
    const changedFilesPath = join(testDirectory, 'changed-files.txt')

    writeFileSync(selectedFilePath, '---\n---\n<img src="/selected.png" />')
    writeFileSync(ignoredFilePath, '---\n---\n<img src="/ignored.png" />')
    writeFileSync(changedFilesPath, 'selected.astro\n')

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      '--dir',
      testDirectory,
      '--changed-files-from',
      changedFilesPath,
      '--json',
      '--fail-on',
      'off',
    ])

    const report = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as JsonReport

    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: selectedFilePath,
          ruleId: 'astro-doctor/no-missing-alt',
        }),
      ]),
    )
    expect(report.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: ignoredFilePath,
        }),
      ]),
    )
  })

  test.each([
    [['--format', 'xml'], 'Unknown format'],
    [['--fail-on', 'sometimes'], 'Unknown fail-on'],
    [['--threshold', '101'], 'Invalid threshold'],
    [['--unknown'], 'Unknown option'],
    [['--dir'], 'requires a value'],
    [['init', '--unknown'], 'Unknown option'],
    [['install', '--unknown'], 'Unknown option'],
  ])('rejects invalid arguments: %j', async (argumentsList, expectedMessage) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    await runCli(argumentsList)

    expect(process.exitCode).toBe(1)
    expect(String(consoleError.mock.calls.at(-1)?.[0])).toContain(expectedMessage)
  })

  test('creates and applies a persistent baseline from the CLI', async () => {
    const astroFilePath = join(testDirectory, 'index.astro')
    const baselineFilePath = join(testDirectory, 'baseline.json')

    writeFileSync(astroFilePath, '---\n---\n<img src="/hero.png" />')

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      'baseline',
      'create',
      '--dir',
      testDirectory,
      '--output',
      baselineFilePath,
    ])

    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Baseline written'),
    )

    consoleLog.mockClear()

    await runCli([
      '--dir',
      testDirectory,
      '--baseline',
      baselineFilePath,
      '--json',
      '--fail-on',
      'off',
    ])

    const report = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as JsonReport

    expect(report.diagnostics).toEqual([])
  })

  test('emits clean SARIF to stdout', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      '---\n---\n<img src="/hero.png" />',
    )

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      '--dir',
      testDirectory,
      '--format',
      'sarif',
      '--fail-on',
      'off',
    ])

    expect(consoleLog).toHaveBeenCalledTimes(1)

    const report = JSON.parse(String(consoleLog.mock.calls[0]?.[0])) as {
      version: string
      runs: readonly unknown[]
    }

    expect(report.version).toBe('2.1.0')
    expect(report.runs).toHaveLength(1)
  })

  test('accepts the all preset and runs all-only upstream rules', async () => {
    writeFileSync(
      join(testDirectory, 'index.astro'),
      '---\n---\n<button aria-hidden="true">Hidden action</button>',
    )

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli([
      '--dir',
      testDirectory,
      '--preset',
      'all',
      '--json',
      '--fail-on',
      'off',
    ])

    const report = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as JsonReport

    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro/jsx-a11y/no-aria-hidden-on-focusable',
        }),
      ]),
    )
  })
})
