import { describe, expect, test } from 'vitest'

import { formatSarifReport, serializeSarifReport } from '../../src/report/sarif.js'
import { createScanResult } from '../../src/utils/create-scan-result.js'

describe('SARIF report', () => {
  test('serializes diagnostics with relative paths, rules, and fingerprints', () => {
    const rootDirectory = '/workspace'
    const result = createScanResult([
      {
        ruleId: 'astro-doctor/no-set-html',
        severity: 'warning',
        message: 'Avoid set:html.',
        filePath: '/workspace/src/pages/index.astro',
        line: 4,
        column: 8,
        category: 'security',
      },
    ], 1)

    const report = formatSarifReport(result, rootDirectory)
    const sarifResult = report.runs[0].results[0]

    expect(report.version).toBe('2.1.0')
    expect(report.runs[0].tool.driver.rules[0]?.id).toBe('astro-doctor/no-set-html')
    expect(sarifResult?.locations[0].physicalLocation.artifactLocation.uri)
      .toBe('src/pages/index.astro')
    expect(sarifResult?.partialFingerprints.astroDoctorFingerprint).toHaveLength(64)
    expect(JSON.parse(serializeSarifReport(report, true))).toEqual(report)
  })

  test('includes official Astro rule metadata', () => {
    const result = createScanResult([
      {
        ruleId: 'astro/jsx-a11y/iframe-has-title',
        severity: 'error',
        message: 'iframe elements must have a unique title property.',
        filePath: '/workspace/index.astro',
        line: 1,
        column: 1,
        category: 'accessibility',
      },
    ], 1)

    const report = formatSarifReport(result, '/workspace')
    const rule = report.runs[0].tool.driver.rules[0]

    expect(rule?.properties.category).toBe('accessibility')
    expect(rule?.helpUri).toContain('eslint-plugin-astro')
  })
})
