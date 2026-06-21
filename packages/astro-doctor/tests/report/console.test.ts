import {describe, expect, test } from 'vitest'

import { formatConsoleReport } from '../../src/report/console.js'
import type { Diagnostic, ScanResult } from '../../src/types.js'

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
