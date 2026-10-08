import { afterEach, describe, expect, test, vi } from 'vitest'

import { trackRun } from '../src/telemetry.js'
import type { ScanResult } from '../src/types.js'

const makeScanResult = (overrides: Partial<ScanResult> = {}): ScanResult => ({
  diagnostics: [],
  fileCount: 1,
  errorCount: 0,
  warningCount: 0,
  score: 100,
  scoreLabel: 'S',
  scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 },
  ...overrides
})

describe('telemetry', () => {
  test('does not throw when disabled', () => {
    expect(() => {
      trackRun({ command: 'scan', flags: {} }, true)
    }).not.toThrow()
  })

  test('does not throw when no endpoint is set', () => {
    const originalEnv = process.env.ASTRO_DOCTOR_TELEMETRY_URL
    delete process.env.ASTRO_DOCTOR_TELEMETRY_URL

    expect(() => {
      trackRun({ command: 'scan', flags: {} }, false)
    }).not.toThrow()

    if (originalEnv) {
      process.env.ASTRO_DOCTOR_TELEMETRY_URL = originalEnv
    }
  })

  test('does not throw when result has diagnostics (covers buildRuleHits)', () => {
    const originalEnv = process.env.ASTRO_DOCTOR_TELEMETRY_URL
    delete process.env.ASTRO_DOCTOR_TELEMETRY_URL

    const result = makeScanResult({
      diagnostics: [
        {
          ruleId: 'astro-doctor/use-astro-image',
          severity: 'warning',
          message: 'Use <Image>',
          filePath: '/test/index.astro',
          line: 1,
          column: 1,
          category: 'performance'
        },
        {
          ruleId: 'astro-doctor/use-astro-image',
          severity: 'warning',
          message: 'Use <Image>',
          filePath: '/test/page.astro',
          line: 2,
          column: 1,
          category: 'performance'
        }
      ],
      warningCount: 2
    })

    expect(() => {
      trackRun({ command: 'scan', flags: {}, result }, false)
    }).not.toThrow()

    if (originalEnv) {
      process.env.ASTRO_DOCTOR_TELEMETRY_URL = originalEnv
    }
  })

  test('calls fetch with POST method when endpoint is set', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', mockFetch)

    process.env.ASTRO_DOCTOR_TELEMETRY_URL = 'https://example.com/telemetry'

    const result = makeScanResult()
    trackRun({ command: 'scan', flags: { verbose: true }, result }, false)

    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('POST')

    delete process.env.ASTRO_DOCTOR_TELEMETRY_URL
    vi.unstubAllGlobals()
  })

  test('clears the request timer when telemetry fails', async () => {
    vi.useFakeTimers()
    vi.stubEnv('ASTRO_DOCTOR_TELEMETRY_URL', 'https://example.com/telemetry')
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')))

    trackRun({ command: 'scan', flags: {} }, false)
    await Promise.resolve()

    expect(vi.getTimerCount()).toBe(0)
  })

  test('CI detection does not throw', () => {
    const originalEnv = process.env.ASTRO_DOCTOR_TELEMETRY_URL
    delete process.env.ASTRO_DOCTOR_TELEMETRY_URL
    process.env.GITHUB_ACTIONS = '1'

    expect(() => {
      trackRun({ command: 'scan', flags: {} }, false)
    }).not.toThrow()

    delete process.env.GITHUB_ACTIONS

    if (originalEnv) {
      process.env.ASTRO_DOCTOR_TELEMETRY_URL = originalEnv
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})
