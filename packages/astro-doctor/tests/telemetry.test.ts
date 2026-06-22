import { describe, expect, test } from 'vitest'

import { trackRun } from '../src/telemetry.js'

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
})
