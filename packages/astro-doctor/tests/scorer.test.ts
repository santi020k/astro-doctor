import { describe, expect, test } from 'vitest'

import { computeScore, computeScoreLabel } from '../src/scorer.js'
import type { Diagnostic } from '../src/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeError = (filePath = 'file.astro'): Diagnostic => ({
  ruleId: 'astro-doctor/no-missing-alt',
  severity: 'error',
  message: 'test error',
  filePath,
  line: 1,
  column: 1,
  category: 'accessibility',
})

const makeWarning = (filePath = 'file.astro'): Diagnostic => ({
  ruleId: 'astro-doctor/no-process-env',
  severity: 'warning',
  message: 'test warning',
  filePath,
  line: 1,
  column: 1,
  category: 'best-practices',
})

// ---------------------------------------------------------------------------
// computeScore
// ---------------------------------------------------------------------------

describe('computeScore', () => {
  test('returns 100 for zero files', () => {
    expect(computeScore([], 0)).toBe(100)
  })

  test('returns 100 for a clean project', () => {
    expect(computeScore([], 10)).toBe(100)
  })

  test('penalizes errors more than warnings', () => {
    const withError = computeScore([makeError()], 1)
    const withWarning = computeScore([makeWarning()], 1)

    expect(withError).toBeLessThan(withWarning)
  })

  test('same issue density across files yields the same score', () => {
    // 1 warning in 1 file vs 1 warning per file across 10 files — identical density
    const small = computeScore([makeWarning('a.astro')], 1)
    const large = computeScore(
      Array.from({ length: 10 }, (_, i) => makeWarning(`file-${i}.astro`)),
      10,
    )

    expect(small).toBe(large)
  })

  test('issues concentrated in one file hurt less than the same count spread across all files', () => {
    // 20 errors in a single file out of 10 → only that file is dragged down
    const concentrated = computeScore(
      Array.from({ length: 20 }, () => makeError('bad.astro')),
      10,
    )
    // 2 errors in each of 10 files → every file is dragged down
    const distributed = computeScore(
      Array.from({ length: 20 }, (_, issueIndex) =>
        makeError(`file-${Math.floor(issueIndex / 2)}.astro`),
      ),
      10,
    )

    expect(concentrated).toBeGreaterThan(distributed)
  })

  test('clamps to 0 at minimum (single file with many errors)', () => {
    const manyErrors = Array.from({ length: 20 }, () => makeError())

    expect(computeScore(manyErrors, 1)).toBe(0)
  })

  test('clamps to 100 at maximum (no issues)', () => {
    expect(computeScore([], 50)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// computeScoreLabel
// ---------------------------------------------------------------------------

describe('computeScoreLabel', () => {
  test('returns A for 90–100', () => {
    expect(computeScoreLabel(100)).toBe('A')
    expect(computeScoreLabel(90)).toBe('A')
  })

  test('returns B for 75–89', () => {
    expect(computeScoreLabel(89)).toBe('B')
    expect(computeScoreLabel(75)).toBe('B')
  })

  test('returns C for 60–74', () => {
    expect(computeScoreLabel(74)).toBe('C')
    expect(computeScoreLabel(60)).toBe('C')
  })

  test('returns D for 40–59', () => {
    expect(computeScoreLabel(59)).toBe('D')
    expect(computeScoreLabel(40)).toBe('D')
  })

  test('returns F for 0–39', () => {
    expect(computeScoreLabel(39)).toBe('F')
    expect(computeScoreLabel(0)).toBe('F')
  })
})
