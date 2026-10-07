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
        category: 'security'
      }
    ], 1)

    expect(formatGithubReport(result)).toBe([
      '::warning file=/workspace/index.astro,line=3,col=5,title=no-set-html::Unsafe 100%25%0A',
      'HTML'
    ].join(''))
  })

  test('returns an empty string for a clean scan', () => {
    expect(formatGithubReport(createScanResult([], 0))).toBe('')
  })

  test('escapes filenames and rule names without allowing new workflow commands', () => {
    const result = createScanResult([
      {
        ruleId: 'astro-doctor/custom,rule:100%\r\nname',
        severity: 'error',
        message: 'Unsafe\r\nHTML: 100%',
        filePath: '/workspace/a,b:100%\r\n::error::injected.astro',
        line: 3,
        column: 5,
        category: 'security'
      }
    ], 1)

    expect(formatGithubReport(result)).toBe([
      '::error file=/workspace/a%2C',
      'b%3A100%25%0D%0A%3A%3A',
      'error%3A%3A',
      'injected.astro,line=3,col=5,title=custom%2C',
      'rule%3A100%25%0D%0A',
      'name::Unsafe%0D%0A',
      'HTML: 100%25'
    ].join(''))
    expect(formatGithubReport(result).split('\n')).toHaveLength(1)
  })
})
