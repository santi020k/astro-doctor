import { describe, expect, test } from 'vitest'

import { formatGithubReport } from '../../src/report/github.js'
import { createScanResult } from '../../src/utils/create-scan-result.js'

describe('GitHub report', () => {
  test('formats escaped workflow annotations', () => {
    const result = createScanResult([
      {
        ruleId: 'astro-doctor/no-set-html',
        severity: 'warning',
        message: 'Unsafe 100%\nHTML',
        filePath: '/workspace/index.astro',
        line: 3,
        column: 5,
        category: 'security',
      },
    ], 1)

    expect(formatGithubReport(result)).toBe([
      '::warning file=/workspace/index.astro,line=3,col=5,title=no-set-html::Unsafe 100%25%0A',
      'HTML',
    ].join(''))
  })

  test('returns an empty string for a clean scan', () => {
    expect(formatGithubReport(createScanResult([], 0))).toBe('')
  })
})
