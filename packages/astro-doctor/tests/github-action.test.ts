import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { parseYAML } from 'confbox'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { isPlainObject } from '../src/utils/is-plain-object.js'

import { ACTION_SCAN_TEST_TIMEOUT_MS } from './constants.js'

interface PreparedScan {
  readonly jsonPath: string
  readonly directory: string
}

interface ActionStep {
  readonly name: string
  readonly run: string
}

const actionFileContent = readFileSync(resolve(import.meta.dirname, '../../../action.yml'), 'utf8')
const actionDocument = parseYAML(actionFileContent)

if (
  !isPlainObject(actionDocument) || !isPlainObject(actionDocument.runs) || !Array.isArray(actionDocument.runs.steps)
) {
  throw new Error('Action must declare composite steps')
}

const actionSteps = actionDocument.runs.steps
  .filter((step: unknown): step is ActionStep => isPlainObject(step) && typeof step.name === 'string' && typeof step.run === 'string')

const getStepScript = (stepName: string): string => {
  const step = actionSteps.find(candidate => candidate.name === stepName)

  if (!step) throw new Error(`Missing shell step: ${stepName}`)

  return step.run
}

const parseOutputs = (outputPath: string): Record<string, string> => Object.fromEntries(
  readFileSync(outputPath, 'utf8').trim().split('\n').filter(Boolean).map(line => {
    const delimiterIndex = line.indexOf('=')

    return [line.slice(0, delimiterIndex), line.slice(delimiterIndex + 1)]
  })
)

let testDirectory = ''
let outputPath = ''

const runStep = (stepName: string, environment: Readonly<Record<string, string>> = {}) => spawnSync(
  'bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', getStepScript(stepName)], {
    cwd: testDirectory,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputPath,
      RUNNER_TEMP: testDirectory,
      FAIL_ON: 'error',
      MIN_SCORE: '0',
      COMMENT: 'true',
      DIFF_ONLY: 'true',
      UPLOAD_SARIF: 'false',
      ...environment
    }
  }
)

const prepareScan = (): PreparedScan => {
  expect(runStep('Prepare scan').status).toBe(0)

  const outputs = parseOutputs(outputPath)

  if (!outputs.json_path || !outputs.directory) throw new Error('Preparation did not return report paths')

  return { jsonPath: outputs.json_path, directory: outputs.directory }
}

const createScanner = (): string => {
  const actionDirectory = join(testDirectory, 'action')
  const cliPath = join(actionDirectory, 'packages/astro-doctor/dist/bin/astro-doctor.js')

  mkdirSync(dirname(cliPath), { recursive: true })
  writeFileSync(cliPath, [
    'const { writeFileSync } = require(\'node:fs\')',
    'if (process.env.FAKE_ARGS) writeFileSync(process.env.FAKE_ARGS, JSON.stringify(process.argv.slice(2)))',
    'if (process.env.FAKE_REPORT) writeFileSync(process.env.JSON_REPORT_PATH, process.env.FAKE_REPORT)',
    'process.exit(Number(process.env.FAKE_SCAN_EXIT || 0))'
  ].join('\n'))

  return actionDirectory
}

const validReport = JSON.stringify({
  errorCount: 0, warningCount: 0, fileCount: 1, score: 100, scoreLabel: 'S', diagnostics: []
})

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-action-'))
  outputPath = join(testDirectory, 'outputs')
  writeFileSync(outputPath, '')
})

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true })
})

describe('GitHub Action shell behavior', () => {
  test('keeps GitHub expressions outside executable shell source', () => {
    for (const step of actionSteps) expect(step.run).not.toContain('${{')
  })

  test('isolates repeated invocations and cleans their temporary reports', () => {
    const first = prepareScan()
    const second = prepareScan()

    expect(first.jsonPath).not.toBe(second.jsonPath)
    expect(runStep('Clean temporary reports', { REPORT_DIRECTORY: first.directory }).status).toBe(0)
    expect(existsSync(first.directory)).toBe(false)
    expect(existsSync(second.directory)).toBe(true)
  })

  test.each([
    { FAIL_ON: 'unknown' },
    { MIN_SCORE: '101' },
    { MIN_SCORE: '1.5' },
    { MIN_SCORE: '-1' },
    { COMMENT: 'yes' },
    { DIFF_ONLY: 'yes' },
    { UPLOAD_SARIF: 'yes' }
  ])('rejects invalid inputs before scanning: %j', environment => {
    expect(runStep('Prepare scan', environment).status).toBe(1)
    expect(parseOutputs(outputPath)).not.toHaveProperty('json_path')
  })

  test('uses action gates without inheriting the project score threshold', () => {
    const prepared = prepareScan()

    writeFileSync(join(testDirectory, 'index.astro'), '<img src="/hero.png" />')
    writeFileSync(join(testDirectory, 'doctor.config.json'), JSON.stringify({ threshold: 100 }))
    expect(runStep('Run Astro Doctor scan', {
      GITHUB_ACTION_PATH: resolve(import.meta.dirname, '../../..'),
      JSON_REPORT_PATH: prepared.jsonPath,
      WORKING_DIRECTORY: testDirectory,
      EVENT_NAME: 'push',
      FAIL_ON: 'off'
    }).status).toBe(0)
    const status = parseOutputs(outputPath).exit_code
    const report = JSON.parse(readFileSync(prepared.jsonPath, 'utf8')) as { score: number }

    expect(report.score).toBeLessThan(100)
    expect(status).toBe('0')
    expect(runStep('Fail check on violations', {
      SCAN_FAILED: 'false', SCAN_STATUS: status ?? '1', SCORE: String(report.score), FAIL_ON: 'off', MIN_SCORE: '0'
    }).status).toBe(0)
    expect(runStep('Fail check on violations', {
      SCAN_FAILED: 'false', SCAN_STATUS: status ?? '1', SCORE: String(report.score), FAIL_ON: 'off', MIN_SCORE: '100'
    }).status).toBe(1)
  }, ACTION_SCAN_TEST_TIMEOUT_MS)

  test('passes paths as literal arguments without executing shell content', () => {
    const prepared = prepareScan()
    const argumentsPath = join(testDirectory, 'arguments.json')
    const workingDirectory = 'project $(touch injected) "quoted"'

    expect(runStep('Run Astro Doctor scan', {
      GITHUB_ACTION_PATH: createScanner(),
      JSON_REPORT_PATH: prepared.jsonPath,
      WORKING_DIRECTORY: workingDirectory,
      EVENT_NAME: 'push',
      FAKE_ARGS: argumentsPath,
      FAKE_REPORT: validReport
    }).status).toBe(0)
    expect(JSON.parse(readFileSync(argumentsPath, 'utf8'))).toContain(workingDirectory)
    expect(existsSync(join(testDirectory, 'injected'))).toBe(false)
  })

  test.each(['', '{bad json', '{"score":100}', validReport.replace('"score":100', '"score":101')])(
    'fails closed when the scanner produces an invalid report: %s', report => {
      const prepared = prepareScan()

      expect(runStep('Run Astro Doctor scan', {
        GITHUB_ACTION_PATH: createScanner(),
        JSON_REPORT_PATH: prepared.jsonPath,
        WORKING_DIRECTORY: '.',
        EVENT_NAME: 'push',
        FAKE_REPORT: report
      }).status).toBe(0)
      expect(runStep('Parse report and set outputs', {
        JSON_REPORT_PATH: prepared.jsonPath, NO_ASTRO_CHANGES: ''
      }).status).toBe(0)
      expect(parseOutputs(outputPath)).toMatchObject({ scan_failed: 'true', score: '0', score_label: 'F' })
      expect(runStep('Fail check on violations', {
        SCAN_FAILED: 'true', SCAN_STATUS: '0', FAIL_ON: 'off'
      }).status).toBe(1)
    }
  )

  test('does not reuse a previous invocation report after a scanner crash', () => {
    const first = prepareScan()

    writeFileSync(first.jsonPath, validReport)

    const second = prepareScan()

    expect(runStep('Run Astro Doctor scan', {
      GITHUB_ACTION_PATH: createScanner(),
      JSON_REPORT_PATH: second.jsonPath,
      WORKING_DIRECTORY: '.',
      EVENT_NAME: 'push',
      FAKE_SCAN_EXIT: '2'
    }).status).toBe(0)
    expect(parseOutputs(outputPath).exit_code).toBe('2')
    expect(runStep('Parse report and set outputs', {
      JSON_REPORT_PATH: second.jsonPath, NO_ASTRO_CHANGES: ''
    }).status).toBe(0)
    expect(parseOutputs(outputPath).scan_failed).toBe('true')
  })

  test('returns deterministic outputs for skipped scans', () => {
    expect(runStep('Parse report and set outputs', {
      JSON_REPORT_PATH: 'missing.json', NO_ASTRO_CHANGES: 'true'
    }).status).toBe(0)
    expect(parseOutputs(outputPath)).toMatchObject({
      scan_failed: 'false', total: '0', errors: '0', warnings: '0', score: '100', score_label: 'S'
    })
  })

  test('parses a valid report and copies it to a nested literal path', () => {
    const prepared = prepareScan()

    writeFileSync(prepared.jsonPath, validReport)
    expect(runStep('Parse report and set outputs', {
      JSON_REPORT_PATH: prepared.jsonPath, NO_ASTRO_CHANGES: ''
    }).status).toBe(0)
    expect(parseOutputs(outputPath)).toMatchObject({ scan_failed: 'false', score: '100' })

    const destinationPath = join(testDirectory, 'reports $(touch injected)', 'scan.json')

    expect(runStep('Copy JSON report to requested path', {
      JSON_REPORT_PATH: prepared.jsonPath, DESTINATION_PATH: destinationPath
    }).status).toBe(0)
    expect(readFileSync(destinationPath, 'utf8')).toBe(validReport)
    expect(existsSync(join(testDirectory, 'injected'))).toBe(false)
  })

  test.each([
    { failOn: 'error', errors: '1', warnings: '0', score: '75', minimum: '0', expected: 1 },
    { failOn: 'error', errors: '0', warnings: '1', score: '90', minimum: '0', expected: 0 },
    { failOn: 'warning', errors: '0', warnings: '1', score: '90', minimum: '0', expected: 1 },
    { failOn: 'off', errors: '1', warnings: '1', score: '65', minimum: '0', expected: 0 },
    { failOn: 'off', errors: '0', warnings: '0', score: '0', minimum: '90', expected: 1 },
    { failOn: 'off', errors: '0', warnings: '0', score: '90', minimum: '90', expected: 0 }
  ])('applies severity and score gates: %j', scenario => {
    expect(runStep('Fail check on violations', {
      SCAN_FAILED: 'false',
      SCAN_STATUS: '0',
      FAIL_ON: scenario.failOn,
      ERRORS: scenario.errors,
      WARNINGS: scenario.warnings,
      SCORE: scenario.score,
      MIN_SCORE: scenario.minimum
    }).status).toBe(scenario.expected)
  })

  test('fails on scanner errors even with a valid report and disabled severity gate', () => {
    expect(runStep('Fail check on violations', {
      SCAN_FAILED: 'false', SCAN_STATUS: '2', ERRORS: '0', WARNINGS: '0', SCORE: '100', FAIL_ON: 'off'
    }).status).toBe(2)
  })

  test.each(['guide.txt', 'src/actions/cart.ts', 'custom-fetch.mts'])('detects relevant PR changes: %s', filePath => {
    execFileSync('git', ['init'], { cwd: testDirectory })
    execFileSync('git', ['config', 'user.email', 'astro-doctor@example.com'], { cwd: testDirectory })
    execFileSync('git', ['config', 'user.name', 'Astro Doctor'], { cwd: testDirectory })
    writeFileSync(join(testDirectory, 'initial.txt'), 'baseline')
    execFileSync('git', ['add', '.'], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: testDirectory })

    const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: testDirectory, encoding: 'utf8' }).trim()
    const changedPath = join(testDirectory, filePath)

    mkdirSync(dirname(changedPath), { recursive: true })
    writeFileSync(changedPath, 'change')
    execFileSync('git', ['add', filePath], { cwd: testDirectory })
    execFileSync('git', ['commit', '-m', 'change'], { cwd: testDirectory })
    expect(runStep('Detect changed Astro Doctor files (PR diff mode)', {
      BASE_SHA: baseCommit, WORKING_DIRECTORY: testDirectory
    }).status).toBe(0)
    expect(parseOutputs(outputPath).no_astro_changes).toBe(filePath === 'guide.txt' ? 'true' : undefined)
  })

  test('restricts PR comments to writable-token contexts', () => {
    expect(actionFileContent).toContain('github.event.pull_request.head.repo.full_name == github.repository')
    expect(actionFileContent).toContain('github.actor != \'dependabot[bot]\'')
  })
})
