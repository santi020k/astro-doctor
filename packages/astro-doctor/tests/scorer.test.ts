import { describe, expect, test } from 'vitest'

import { computeScore, computeScoreLabel } from '../src/scorer.js'

describe('computeScore', () => {
  test('returns 100 for zero files', () => {
    expect(computeScore(0, 0, 0)).toBe(100)
  })

  test('returns 100 for a clean project', () => {
    expect(computeScore(0, 0, 10)).toBe(100)
  })

  test('penalizes errors more than warnings', () => {
    const withError = computeScore(1, 0, 1)
    const withWarning = computeScore(0, 1, 1)
    expect(withError).toBeLessThan(withWarning)
  })

  test('normalizes by file count (density not raw count)', () => {
    // 10 warnings across 10 files = same density as 1 warning across 1 file
    const small = computeScore(0, 1, 1)
    const large = computeScore(0, 10, 10)
    expect(small).toBe(large)
  })

  test('clamps to 0 at minimum', () => {
    expect(computeScore(100, 100, 1)).toBe(0)
  })

  test('clamps to 100 at maximum', () => {
    expect(computeScore(0, 0, 50)).toBe(100)
  })
})

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
