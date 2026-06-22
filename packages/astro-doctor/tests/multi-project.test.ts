import { describe, expect, test } from 'vitest'

import { aggregateResults, resolveProjectDirectories } from '../src/multi-project.js'
import type { ProjectScanResult } from '../src/types.js'

describe('multi-project', () => {
  describe('aggregateResults', () => {
    test('returns perfect score for empty results', () => {
      const result = aggregateResults([])
      expect(result.score).toBe(100)
      expect(result.scoreLabel).toBe('S')
      expect(result.fileCount).toBe(0)
    })

    test('aggregates multiple results', () => {
      const results: ProjectScanResult[] = [
        {
          name: 'p1',
          directory: '/p1',
          diagnostics: [{
            ruleId: 'astro-doctor/no-set-html',
            message: 'err',
            severity: 'error',
            line: 1,
            column: 1,
            filePath: '/p1/a.astro',
            category: 'security'
          }],
          fileCount: 1,
          errorCount: 1,
          warningCount: 0,
          score: 80,
          scoreLabel: 'B',
          scoreBreakdown: { performance: 100, accessibility: 100, security: 0, 'best-practices': 100 }
        },
        {
          name: 'p2',
          directory: '/p2',
          diagnostics: [],
          fileCount: 1,
          errorCount: 0,
          warningCount: 0,
          score: 100,
          scoreLabel: 'S',
          scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 }
        }
      ]

      const agg = aggregateResults(results)
      expect(agg.fileCount).toBe(2)
      expect(agg.errorCount).toBe(1)
      expect(agg.diagnostics).toHaveLength(1)
      expect(agg.score).toBeLessThan(100)
    })
  })

  describe('resolveProjectDirectories', () => {
    test('handles unknown projects gracefully', async () => {
      const dirs = await resolveProjectDirectories(['does-not-exist'], process.cwd())
      expect(dirs).toHaveLength(0)
    })
  })
})
