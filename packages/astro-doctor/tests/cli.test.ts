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
})
