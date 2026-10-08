import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { readPersistentBaseline } from '../src/baseline.js'
import { runCli } from '../src/cli.js'
import { getPresetRules } from '../src/presets.js'
import { scan } from '../src/scanner/index.js'
import { formatFixDiff } from '../src/utils/format-fix-diff.js'

describe('diagnostic workflows', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'astro-doctor-workflows-'))
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(directory, { recursive: true, force: true })
    process.exitCode = undefined
  })

  test('scans and previews TypeScript frontmatter without a false clean score', async () => {
    const source = '---\nconst token: string = process.env.SECRET\n---\n<img src="/hero.png" />'
    const filePath = join(directory, 'index.astro')

    writeFileSync(filePath, source)

    const result = await scan({ directory })

    expect(result.score).toBeLessThan(100)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'astro-doctor/no-process-env' }),
      expect.objectContaining({ ruleId: 'astro-doctor/no-missing-alt' })
    ]))

    const preview = await scan({ directory, fixDryRun: true })

    expect(preview.fixPreview?.changes[0]?.diff).toContain('+const token: string = import.meta.env.SECRET')
    expect(readFileSync(filePath, 'utf8')).toBe(source)
  })

  test('rejects malformed source instead of returning a clean ordinary scan', async () => {
    writeFileSync(join(directory, 'index.astro'), '---\nconst token =\n---\n<div />')

    await expect(scan({ directory })).rejects.toThrow('source could not be parsed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    await runCli(['baseline', 'create', '--dir', directory])
    expect(process.exitCode).toBe(1)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('source could not be parsed'))
    expect(existsSync(join(directory, '.astro-doctor-baseline.json'))).toBe(false)
  })

  test('retains fatal diagnostics in the editor scan mode', async () => {
    writeFileSync(join(directory, 'index.astro'), '---\nconst token =\n---\n<div />')
    const result = await scan({ directory, failOnParseError: false })

    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'astro-doctor/parse-error', severity: 'error' })
    ]))
    expect(result.score).toBeLessThan(100)
    await expect(scan({ directory, failOnParseError: false, fixDryRun: true })).rejects.toThrow('source could not be parsed')
  })

  test.each([
    { rootPreset: 'recommended', projectPreset: 'strict', lifecycleSeverity: 'error' },
    { rootPreset: 'strict', projectPreset: 'recommended', lifecycleSeverity: undefined }
  ])('explains the selected project $projectPreset preset over root $rootPreset', async ({ rootPreset, projectPreset, lifecycleSeverity }) => {
    const project = join(directory, 'apps', 'one')

    mkdirSync(project, { recursive: true })
    writeFileSync(join(directory, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n')
    writeFileSync(join(directory, 'doctor.config.json'), JSON.stringify({ preset: rootPreset }))
    writeFileSync(join(project, 'package.json'), JSON.stringify({ dependencies: { astro: '^7.0.0' } }))
    writeFileSync(join(project, 'doctor.config.json'), JSON.stringify({ preset: projectPreset }))
    writeFileSync(join(project, 'index.astro'), '<ClientRouter /><script>document.addEventListener("DOMContentLoaded", () => {})</script>')
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli(['explain-config', 'apps/one/index.astro', '--dir', directory, '--json'])
    const explanation = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as {
      preset: string
      projectRules: Record<string, string>
    }

    expect(explanation.preset).toBe(projectPreset)
    expect(explanation.projectRules['astro-doctor/require-client-router-script-lifecycle']).toBe(lifecycleSeverity)

    await runCli(['--dir', directory, '--json', '--fail-on', 'off'])
    const result = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as { diagnostics: { ruleId: string }[] }

    expect(result.diagnostics.some(diagnostic => diagnostic.ruleId === 'astro-doctor/require-client-router-script-lifecycle')).toBe(projectPreset === 'strict')
  })

  test('workspace fix previews apply from the invocation root with distinct targets', async () => {
    writeFileSync(join(directory, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n')
    for (const name of ['one', 'two']) {
      const project = join(directory, 'apps', name)

      mkdirSync(project, { recursive: true })
      writeFileSync(join(project, 'package.json'), JSON.stringify({ name, dependencies: { astro: '^7.0.0' } }))
      writeFileSync(join(project, 'index.astro'), '---\nconst title = process.env.SITE_TITLE\n---\n<h1>{title}</h1>\n')
    }
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli(['--dir', directory, '--fix-dry-run', '--json', '--fail-on', 'off'])
    const result = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0])) as {
      fixPreview: { changes: { diff: string }[] }
    }
    const patch = result.fixPreview.changes.map(change => change.diff).join('\n') + '\n'

    expect(patch).toContain('a/apps/one/index.astro')
    expect(patch).toContain('a/apps/two/index.astro')
    expect(() => execFileSync('git', ['apply', '--check', '-'], { cwd: directory, input: patch })).not.toThrow()
  })

  test('previews fixes and remaining manual findings without writing source or cache', async () => {
    const filePath = join(directory, 'index.astro')
    const source = '---\nconst title = process.env.SITE_TITLE\n---\n<h1>{title}</h1>\n<img src="/hero.png" />\n'

    writeFileSync(filePath, source)

    const result = await scan({ directory, fixDryRun: true, cache: true })

    expect(readFileSync(filePath, 'utf8')).toBe(source)
    expect(result.fixPreview?.changes).toEqual([expect.objectContaining({
      filePath
    })])
    expect(result.fixPreview?.changes[0]?.diff).toContain('+const title = import.meta.env.SITE_TITLE')

    expect(result.fixPreview?.fixedCount).toBeGreaterThan(0)
    expect(result.fixPreview?.remainingCount).toBeGreaterThan(0)
    expect(result.timings?.cacheEnabled).toBe(false)
    expect(existsSync(join(directory, '.astro-doctor'))).toBe(false)
  })

  test('emits fix preview as JSON and rejects contradictory fix flags', async () => {
    writeFileSync(join(directory, 'index.astro'), '---\nconst title = process.env.SITE_TITLE\n---\n<h1>{title}</h1>')
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    await runCli(['--dir', directory, '--fix-dry-run', '--json', '--fail-on', 'off'])

    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      fixPreview: { fixedCount: 1, remainingCount: 0 }
    })

    await runCli(['--dir', directory, '--fix-dry-run', '--fix'])

    expect(process.exitCode).toBe(1)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('cannot be combined'))
  })

  test('explains preset, ordered overrides and ignored files using scan configuration', async () => {
    mkdirSync(join(directory, 'src'), { recursive: true })
    writeFileSync(join(directory, 'src', 'index.astro'), '<div />')
    writeFileSync(join(directory, 'doctor.config.json'), JSON.stringify({
      preset: 'strict',
      ignore: ['src/index.astro'],
      overrides: [
        { files: ['src/**/*.astro'], rules: { 'astro-doctor/no-missing-alt': 'warn' } },
        { files: ['src/index.astro'], rules: { 'astro-doctor/no-missing-alt': 'off' } },
        { files: ['other/**'], rules: { 'astro-doctor/no-missing-lang': 'off' } }
      ]
    }))
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli(['explain-config', 'src/index.astro', '--dir', directory, '--json'])

    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      preset: 'strict',
      ignored: true,
      matchedOverrides: [0, 1],
      rules: { 'astro-doctor/no-missing-alt': 'off' }
    })
  })

  test('reports baseline progress and prunes only resolved occurrences', async () => {
    const filePath = join(directory, 'index.astro')
    const baselinePath = join(directory, '.astro-doctor-baseline.json')

    writeFileSync(filePath, '<img src="/one.png" alt="One" /><img src="/two.png" alt="Two" />')
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli(['baseline', 'create', '--dir', directory])
    writeFileSync(filePath, '<img src="/one.png" />')
    await runCli(['--dir', directory, '--baseline', baselinePath, '--json', '--fail-on', 'off'])

    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      baselineProgress: { newCount: 1, existingCount: 1, resolvedCount: 1 }
    })

    await runCli(['baseline', 'prune', '--dir', directory])

    const baseline = readPersistentBaseline(baselinePath)

    expect(baseline.entries).toHaveLength(1)
    expect(baseline.entries[0]?.count).toBe(1)
    expect(baseline.entries[0]?.fingerprint).toContain('use-astro-image')

    await runCli(['baseline', 'prune', '--dir', directory])

    expect(readPersistentBaseline(baselinePath).entries).toEqual(baseline.entries)
  })

  test('does not report resolved findings for category-filtered scans or permit partial pruning', async () => {
    const filePath = join(directory, 'index.astro')

    writeFileSync(filePath, '<img src="/hero.png" />')
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    await runCli(['baseline', 'create', '--dir', directory])
    const baselinePath = join(directory, '.astro-doctor-baseline.json')
    const before = readFileSync(baselinePath, 'utf8')

    await runCli(['--dir', directory, '--category', 'security', '--baseline', baselinePath, '--json'])

    const report: unknown = JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))

    expect(report).toMatchObject({ baselineProgress: { newCount: 0, existingCount: 0 } })
    expect(JSON.stringify(report)).not.toContain('resolvedCount')

    await runCli(['baseline', 'prune', '--dir', directory, '--category', 'security'])

    expect(process.exitCode).toBe(1)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('full scan'))
    expect(readFileSync(baselinePath, 'utf8')).toBe(before)
  })

  test('previews official Astro fixes and preserves source until fix is explicitly requested', async () => {
    const filePath = join(directory, 'index.astro')
    const source = '---\nconst message = "Hello"\n---\n<p set:text={message} />'

    writeFileSync(filePath, source)

    const preview = await scan({ directory, fixDryRun: true, rules: getPresetRules('strict') })

    expect(preview.fixPreview?.fixedCount).toBe(1)
    expect(preview.fixPreview?.changes[0]?.diff).toMatch(/\+<p\s*>\{message\}<\/p>/u)
    expect(readFileSync(filePath, 'utf8')).toBe(source)

    const fixed = await scan({ directory, fix: true, rules: getPresetRules('strict') })

    expect(fixed.diagnostics).toEqual(preview.diagnostics)
    expect(readFileSync(filePath, 'utf8')).toMatch(/<p\s*>\{message\}<\/p>/u)
  })

  test('returns empty previews for clean and empty projects', async () => {
    const empty = await scan({ directory, fixDryRun: true })

    expect(empty.fixPreview).toEqual({ changes: [], fixedCount: 0, remainingCount: 0 })
    writeFileSync(join(directory, 'index.astro'), '<p>Hello</p>')

    const clean = await scan({ directory, fixDryRun: true })

    expect(clean.fixPreview).toEqual(empty.fixPreview)
  })

  test('leaves the baseline unchanged when an Astro file cannot be parsed', async () => {
    const filePath = join(directory, 'index.astro')
    const baselinePath = join(directory, '.astro-doctor-baseline.json')

    writeFileSync(filePath, '<img src="/hero.png" />')
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    await runCli(['baseline', 'create', '--dir', directory])
    const before = readFileSync(baselinePath, 'utf8')

    writeFileSync(filePath, '---\nconst invalid = ;\n---\n<p>Hello</p>')
    await runCli(['baseline', 'prune', '--dir', directory])

    expect(process.exitCode).toBe(1)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('source could not be parsed'))
    expect(readFileSync(baselinePath, 'utf8')).toBe(before)
    await expect(scan({ directory, fixDryRun: true })).rejects.toThrow('source could not be parsed')
    consoleError.mockClear()
    await runCli(['--dir', directory, '--baseline', baselinePath, '--json'])
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('source could not be parsed'))
  })

  test.each([
    ['--scope', 'files'],
    ['--scope', 'changed'],
    ['--staged'],
    ['--no-lint'],
    ['--fix'],
    ['--fix-dry-run'],
    ['--changed-files-from', 'files.txt'],
    ['--project', 'site']
  ])('rejects partial baseline pruning with %j', async (...flags) => {
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    await runCli(['baseline', 'prune', '--dir', directory, ...flags])

    expect(process.exitCode).toBe(1)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('full scan'))
  })

  test('resolves deleted-file debt without adding new findings', async () => {
    const filePath = join(directory, 'index.astro')
    const baselinePath = join(directory, '.astro-doctor-baseline.json')

    writeFileSync(filePath, '<img src="/hero.png" />')
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli(['baseline', 'create', '--dir', directory])
    rmSync(filePath)
    await runCli(['--dir', directory, '--baseline', baselinePath, '--json'])

    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      baselineProgress: { newCount: 0, existingCount: 0, resolvedCount: 2 }
    })
    await runCli(['baseline', 'prune', '--dir', directory])
    expect(readPersistentBaseline(baselinePath).entries).toEqual([])
  })

  test('aggregates baseline progress across workspace projects and preserves project configuration', async () => {
    const firstProject = join(directory, 'apps', 'one')
    const secondProject = join(directory, 'apps', 'two')

    writeFileSync(join(directory, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n')
    for (const project of [firstProject, secondProject]) {
      mkdirSync(project, { recursive: true })
      writeFileSync(join(project, 'package.json'), JSON.stringify({ name: project, dependencies: { astro: '^7.0.0' } }))
      writeFileSync(join(project, 'index.astro'), '<img src="/hero.png" alt="Hero" />')
    }
    writeFileSync(join(firstProject, 'doctor.config.json'), JSON.stringify({
      overrides: [{ files: ['index.astro'], rules: { 'astro-doctor/no-missing-alt': 'warn' } }]
    }))
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli(['baseline', 'create', '--dir', directory])
    writeFileSync(join(firstProject, 'index.astro'), '<img src="/hero.png" />')
    await runCli(['--dir', directory, '--baseline', '.astro-doctor-baseline.json', '--json', '--fail-on', 'off'])

    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      baselineProgress: { newCount: 1, existingCount: 2, resolvedCount: 0 }
    })
    await runCli(['explain-config', 'apps/one/index.astro', '--dir', directory, '--json'])
    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      directory: firstProject, matchedOverrides: [0], rules: { 'astro-doctor/no-missing-alt': 'warn' }
    })
  })

  test('explains missing files as errors and checks project audit rules independently', async () => {
    writeFileSync(join(directory, 'astro.config.mjs'), 'export default {}')
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    await runCli(['explain-config', 'astro.config.mjs', '--dir', directory, '--json'])

    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      rules: {}, projectRules: { 'astro-doctor/no-disabled-origin-check': 'warn' }
    })
    await runCli(['explain-config', 'missing.astro', '--dir', directory])
    expect(process.exitCode).toBe(1)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('existing file'))
  })

  test.each([
    ['before\n', 'after\n'],
    ['before', 'after'],
    ['', 'added\n'],
    ['removed\n', ''],
    ['unchanged\nbefore\nend\n', 'unchanged\nafter\nend\n'],
    ['same', 'same\n']
  ])('generates a valid unified patch for source %j', (original, fixed) => {
    const fileName = 'page with spaces.astro'

    writeFileSync(join(directory, fileName), original)
    const patch = formatFixDiff(fileName, original, fixed)

    execFileSync('git', ['apply', '--check', '-'], { cwd: directory, input: `${patch}\n` })
    execFileSync('git', ['apply', '-'], { cwd: directory, input: `${patch}\n` })
    expect(readFileSync(join(directory, fileName), 'utf8')).toBe(fixed)
  })

  test('explains hidden-file discovery exclusions without claiming a matching ignore pattern', async () => {
    writeFileSync(join(directory, '.hidden.astro'), '<p>Hello</p>')
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(vi.fn())

    await runCli(['explain-config', '.hidden.astro', '--dir', directory, '--json'])

    expect(JSON.parse(String(consoleLog.mock.calls.at(-1)?.[0]))).toMatchObject({
      ignored: true, discoveryExcluded: true, ignorePatterns: []
    })
    const result = await scan({ directory })

    expect(result.fileCount).toBe(0)
  })
})
