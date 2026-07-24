import { describe, expect, test } from 'vitest'

import { CI_THRESHOLD_SCORE, DISABLED_THRESHOLD_SCORE } from '../src/constants.js'
import { getPresetFailOn, getPresetRules, getPresetThreshold, isPresetName } from '../src/presets.js'

describe('isPresetName', () => {
  test("returns true for 'recommended'", () => {
    expect(isPresetName('recommended')).toBe(true)
  })

  test("returns true for 'strict'", () => {
    expect(isPresetName('strict')).toBe(true)
  })

  test("returns true for 'ci'", () => {
    expect(isPresetName('ci')).toBe(true)
  })

  test("returns true for 'all'", () => {
    expect(isPresetName('all')).toBe(true)
  })

  test('returns false for arbitrary string', () => {
    expect(isPresetName('other')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isPresetName('')).toBe(false)
  })

  test('returns false for a number', () => {
    expect(isPresetName(42)).toBe(false)
  })

  test('returns false for null', () => {
    expect(isPresetName(null)).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isPresetName(undefined as unknown)).toBe(false)
  })
})

describe('getPresetRules', () => {
  test("'recommended' returns an object with at least one rule", () => {
    const rules = getPresetRules('recommended')
    expect(typeof rules).toBe('object')
    expect(Object.keys(rules).length).toBeGreaterThan(0)
  })

  test("'recommended' all values are valid severities", () => {
    const rules = getPresetRules('recommended')
    const validSeverities = new Set(['error', 'warn', 'off'])
    for (const value of Object.values(rules)) {
      expect(validSeverities.has(value)).toBe(true)
    }
  })

  test("'strict' enables every non-duplicate rule as an error", () => {
    const rules = getPresetRules('strict')

    for (const value of Object.values(rules)) {
      expect(['error', 'off']).toContain(value)
    }

    expect(Object.values(rules)).not.toContain('warn')
  })

  test("'strict' includes additional accessibility and strict Astro rules", () => {
    const recommendedKeys = Object.keys(getPresetRules('recommended')).sort()
    const strictKeys = Object.keys(getPresetRules('strict')).sort()

    expect(strictKeys.length).toBeGreaterThan(recommendedKeys.length)
    expect(strictKeys).toContain('astro/no-unused-css-selector')
    expect(strictKeys).toContain('astro/jsx-a11y/anchor-is-valid')
  })

  test("'ci' returns same rules as 'recommended'", () => {
    const ciRules = getPresetRules('ci')
    const recommendedRules = getPresetRules('recommended')
    expect(ciRules).toEqual(recommendedRules)
  })

  test("'recommended' leaves package-manager preference opt-in", () => {
    expect(getPresetRules('recommended')).not.toHaveProperty('astro-doctor/prefer-pnpm')
  })

  test("'all' enables at least every strict rule", () => {
    const allRules = getPresetRules('all')
    const strictRules = getPresetRules('strict')

    expect(Object.keys(allRules).length).toBeGreaterThanOrEqual(Object.keys(strictRules).length)
  })

  test("'all' enables all 54 non-deprecated upstream rules", () => {
    const allRules = getPresetRules('all')
    const activeAstroRuleIds = Object.entries(allRules)
      .filter(([ruleId, severity]) => ruleId.startsWith('astro/') && severity !== 'off')

    expect(activeAstroRuleIds).toHaveLength(54)
    expect(allRules['astro/sort-attributes']).toBe('error')
    expect(allRules['astro/valid-compile']).toBeUndefined()
    expect(allRules['astro-doctor/prefer-class-list']).toBe('off')
  })
})

describe('getPresetFailOn', () => {
  test("'ci' returns 'warning'", () => {
    expect(getPresetFailOn('ci')).toBe('warning')
  })

  test("'recommended' returns 'error'", () => {
    expect(getPresetFailOn('recommended')).toBe('error')
  })

  test("'strict' returns 'error'", () => {
    expect(getPresetFailOn('strict')).toBe('error')
  })
})

describe('getPresetThreshold', () => {
  test("'ci' returns CI_THRESHOLD_SCORE", () => {
    expect(getPresetThreshold('ci')).toBe(CI_THRESHOLD_SCORE)
  })

  test("'recommended' returns DISABLED_THRESHOLD_SCORE", () => {
    expect(getPresetThreshold('recommended')).toBe(DISABLED_THRESHOLD_SCORE)
  })

  test("'strict' returns DISABLED_THRESHOLD_SCORE", () => {
    expect(getPresetThreshold('strict')).toBe(DISABLED_THRESHOLD_SCORE)
  })
})
