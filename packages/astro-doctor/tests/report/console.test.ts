import {describe, expect, test } from 'vitest'

import { formatConsoleReport, formatProjectScoreTable, formatScoreOnly } from '../../src/report/console.js'
import type { Diagnostic, ProjectScanResult, ScanResult } from '../../src/types.js'

const makeDiagnostic = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  ruleId: 'astro-doctor/use-astro-image',
  severity: 'warning',
  message: 'Use <Image> instead of <img>.',
  filePath: '/project/src/pages/index.astro',
  line: 5,
  column: 1,
  category: 'performance',
  ...overrides,
})

const makeScanResult = (overrides: Partial<ScanResult> = {}): ScanResult => ({
  diagnostics: [],
  fileCount: 1,
  errorCount: 0,
  warningCount: 0,
  score: 100,
  scoreLabel: 'A',
  scoreBreakdown: {
    performance: 100,
    accessibility: 100,
    security: 100,
    'best-practices': 100,
    architecture: 100,
  },
  ...overrides,
})

describe('formatConsoleReport', () => {
  test('returns a clean message when there are no diagnostics', () => {
    const output = formatConsoleReport(makeScanResult())
    expect(output).toMatch(/no issues/i)
  })

  test('includes the file path in the output', () => {
    const diagnostic = makeDiagnostic()
    const output = formatConsoleReport(makeScanResult({ diagnostics: [diagnostic], warningCount: 1 }))
    expect(output).toContain('index.astro')
  })

  test('includes the rule ID in the output', () => {
    const diagnostic = makeDiagnostic()
    const output = formatConsoleReport(makeScanResult({ diagnostics: [diagnostic], warningCount: 1 }))
    expect(output).toContain('use-astro-image')
  })

  test('includes the diagnostic message in the output', () => {
    const diagnostic = makeDiagnostic({ message: 'Use <Image> instead of <img>.' })
    const output = formatConsoleReport(makeScanResult({ diagnostics: [diagnostic], warningCount: 1 }))
    expect(output).toContain('Use <Image> instead of <img>.')
  })

  test('includes line and column numbers in the output', () => {
    const diagnostic = makeDiagnostic({ line: 10, column: 3 })
    const output = formatConsoleReport(makeScanResult({ diagnostics: [diagnostic], warningCount: 1 }))
    expect(output).toContain('10')
    expect(output).toContain('3')
  })

  test('shows a summary with total counts', () => {
    const diagnostics: Diagnostic[] = [
      makeDiagnostic({ severity: 'error' }),
      makeDiagnostic({ severity: 'warning' }),
    ]
    const output = formatConsoleReport(
      makeScanResult({ diagnostics, errorCount: 1, warningCount: 1, fileCount: 2 })
    )
    expect(output).toContain('1 error')
    expect(output).toContain('1 warning')
  })

  test('shows the number of files scanned', () => {
    const output = formatConsoleReport(makeScanResult({ fileCount: 42 }))
    expect(output).toContain('42')
  })

  test('shows the health score by default', () => {
    const output = formatConsoleReport(makeScanResult({ score: 85, scoreLabel: 'B' }))
    expect(output).toContain('85/100')
    expect(output).toContain('B')
  })

  test('hides the score when showScore is false', () => {
    const output = formatConsoleReport(makeScanResult({ score: 85, scoreLabel: 'B' }), process.cwd(), false)
    expect(output).not.toContain('85/100')
  })
})

const makeProject = (overrides: Partial<ProjectScanResult> = {}): ProjectScanResult => ({
  name: 'test-project',
  directory: '/test',
  diagnostics: [],
  fileCount: 1,
  errorCount: 0,
  warningCount: 0,
  score: 100,
  scoreLabel: 'S',
  scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 },
  ...overrides,
})

describe('formatScoreOnly', () => {
  test('returns score as string for score 95', () => {
    const result = formatScoreOnly(makeScanResult({ score: 95 }))
    expect(result).toBe('95')
  })

  test("returns '0' for score 0", () => {
    const result = formatScoreOnly(makeScanResult({ score: 0 }))
    expect(result).toBe('0')
  })

  test("returns '100' for score 100", () => {
    const result = formatScoreOnly(makeScanResult({ score: 100 }))
    expect(result).toBe('100')
  })
})

describe('formatConsoleReport with verbose mode', () => {
  test('includes "Rule summary" in output when verbose=true with diagnostics', () => {
    const diagnostic = makeDiagnostic()
    const output = formatConsoleReport(
      makeScanResult({ diagnostics: [diagnostic], warningCount: 1 }),
      process.cwd(),
      true,
      true,
    )
    expect(output).toContain('Rule summary')
  })

  test('marks rules with issues with ✖ count', () => {
    const diagnostic = makeDiagnostic({ ruleId: 'astro-doctor/use-astro-image' })
    const output = formatConsoleReport(
      makeScanResult({ diagnostics: [diagnostic], warningCount: 1 }),
      process.cwd(),
      true,
      true,
    )
    expect(output).toContain('✖')
  })

  test('marks rules with no issues with ✔', () => {
    const diagnostic = makeDiagnostic({ ruleId: 'astro-doctor/use-astro-image' })
    const output = formatConsoleReport(
      makeScanResult({ diagnostics: [diagnostic], warningCount: 1 }),
      process.cwd(),
      true,
      true,
    )
    expect(output).toContain('✔')
  })

  test('verbose mode works when there are no diagnostics (shows all rules as ✔)', () => {
    const output = formatConsoleReport(
      makeScanResult({ diagnostics: [] }),
      process.cwd(),
      true,
      true,
    )
    expect(output).toContain('Rule summary')
    expect(output).toContain('✔')
    expect(output).not.toContain('✖')
  })
})

describe('formatProjectScoreTable', () => {
  const makeAggregate = (overrides: Partial<ScanResult> = {}): ScanResult => makeScanResult(overrides)

  test('returns empty string when showScore is false', () => {
    const result = formatProjectScoreTable([makeProject()], makeAggregate(), false)
    expect(result).toBe('')
  })

  test('returns empty string when projects array is empty even with showScore true', () => {
    const result = formatProjectScoreTable([], makeAggregate(), true)
    expect(result).toBe('')
  })

  test('includes project names and score when showScore=true with projects', () => {
    const project = makeProject({ name: 'my-app', score: 90, scoreLabel: 'A' })
    const result = formatProjectScoreTable([project], makeAggregate({ score: 90, scoreLabel: 'A' }), true)
    expect(result).toContain('my-app')
    expect(result).toContain('90/100')
  })

  test("includes 'aggregate' line", () => {
    const project = makeProject({ name: 'my-app' })
    const result = formatProjectScoreTable([project], makeAggregate(), true)
    expect(result).toContain('aggregate')
  })

  test("shows 'no issues' for project with 0 errors and warnings", () => {
    const project = makeProject({ errorCount: 0, warningCount: 0 })
    const result = formatProjectScoreTable([project], makeAggregate(), true)
    expect(result).toContain('no issues')
  })

  test("shows issue count for project with issues ('5 issues' when errorCount=3+warningCount=2)", () => {
    const project = makeProject({ errorCount: 3, warningCount: 2, score: 70, scoreLabel: 'C' })
    const result = formatProjectScoreTable([project], makeAggregate({ score: 70, scoreLabel: 'C' }), true)
    expect(result).toContain('5 issues')
  })

  test("handles single issue ('1 issue') for singular form", () => {
    const project = makeProject({ errorCount: 1, warningCount: 0, score: 80, scoreLabel: 'B' })
    const result = formatProjectScoreTable([project], makeAggregate({ score: 80, scoreLabel: 'B' }), true)
    expect(result).toContain('1 issue')
    expect(result).not.toContain('1 issues')
  })
})
