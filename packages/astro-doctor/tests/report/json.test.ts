import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import { formatJsonReport } from '../../src/report/json.js'
import type { ScanResult } from '../../src/types.js'

const CLEAN_RESULT: ScanResult = {
  diagnostics: [],
  fileCount: 0,
  errorCount: 0,
  warningCount: 0,
  score: 100,
  scoreLabel: 'S',
  scoreBreakdown: {
    performance: 100,
    accessibility: 100,
    security: 100,
    'best-practices': 100,
  },
}

const getExpectedPackageVersion = (): string => {
  const packageMetadata: unknown = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  )

  if (
    typeof packageMetadata !== 'object' ||
    packageMetadata === null ||
    !('version' in packageMetadata) ||
    typeof packageMetadata.version !== 'string'
  ) {
    throw new Error('Package version is missing.')
  }

  return packageMetadata.version
}

describe('formatJsonReport', () => {
  test('uses the published package version', () => {
    const report = formatJsonReport(CLEAN_RESULT, '/project')

    expect(report.version).toBe(getExpectedPackageVersion())
    expect(report.schemaVersion).toBe(1)
    expect(report.scoreModel).toBe(2)
    expect(report.scope).toBe('full')
  })
})
