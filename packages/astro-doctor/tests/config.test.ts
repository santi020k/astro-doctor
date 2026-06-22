import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('returns null when no config file exists', async () => {
    const result = await loadConfig(testDirectory)
    expect(result).toBeNull()
  })

  test('loads empty JSON config {}', async () => {
    writeFileSync(join(testDirectory, 'doctor.config.json'), '{}')
    const result = await loadConfig(testDirectory)
    expect(result).toEqual({})
  })

  test('loads full JSON config with all fields', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({
        threshold: 80,
        failOn: 'error',
        preset: 'recommended',
        ignore: ['node_modules/**'],
        rules: { 'astro-doctor/no-set-html': 'warn' },
      }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.threshold).toBe(80)
    expect(result?.failOn).toBe('error')
    expect(result?.preset).toBe('recommended')
    expect(result?.ignore).toEqual(['node_modules/**'])
    expect(result?.rules?.['astro-doctor/no-set-html']).toBe('warn')
  })

  test('loads JSONC config with comments', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.jsonc'),
      `{
  // This is a comment
  "threshold": 70,
  "failOn": "warning" /* inline comment */
}`,
    )
    const result = await loadConfig(testDirectory)
    expect(result?.threshold).toBe(70)
    expect(result?.failOn).toBe('warning')
  })

  test('unwraps default key from config object', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ default: { threshold: 80 } }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.threshold).toBe(80)
  })

  test('throws with filename in error message on invalid failOn', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: 'invalid' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('Failed to load doctor.config.json')
  })

  test('throws with "Invalid failOn" message', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: 'invalid' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('Invalid failOn')
  })

  test('error message mentions valid failOn values', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: 'bad' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow(/error.*warning.*off/i)
  })

  test('throws on invalid preset', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ preset: 'invalid-preset' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('Invalid preset')
  })

  test('error message mentions valid preset values', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ preset: 'bad' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow(/recommended.*strict.*ci/i)
  })

  test('throws on threshold that is not a number', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ threshold: 'high' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('threshold')
  })

  test('throws on threshold below 0', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ threshold: -1 }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('threshold')
  })

  test('throws on threshold above 100', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ threshold: 101 }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('threshold')
  })

  test('throws on ignore that is not an array', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ ignore: 'node_modules/**' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow(/ignore/i)
  })

  test('throws on ignore array with non-string items', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ ignore: [42] }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow(/ignore/i)
  })

  test('throws on rules that is not an object', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ rules: 'all' }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow(/rules/i)
  })

  test('throws on invalid rule severity with rule ID and value in message', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ rules: { 'astro-doctor/no-set-html': 'invalid-severity' } }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('astro-doctor/no-set-html')
    await expect(loadConfig(testDirectory)).rejects.toThrow('invalid-severity')
  })

  test('throws when config JSON is an array, not a plain object', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify([{ threshold: 80 }]),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('plain object')
  })

  test('throws when config default field is not a plain object', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ default: [{ threshold: 80 }] }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('plain object')
  })

  test('describes null value in failOn error message', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: null }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('null')
  })

  test('describes boolean value in failOn error message', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: true }),
    )
    await expect(loadConfig(testDirectory)).rejects.toThrow('true')
  })

  test("loads 'recommended' preset", async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ preset: 'recommended' }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.preset).toBe('recommended')
  })

  test("loads 'strict' preset", async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ preset: 'strict' }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.preset).toBe('strict')
  })

  test("loads 'ci' preset", async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ preset: 'ci' }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.preset).toBe('ci')
  })

  test("loads 'error' failOn", async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: 'error' }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.failOn).toBe('error')
  })

  test("loads 'warning' failOn", async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: 'warning' }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.failOn).toBe('warning')
  })

  test("loads 'off' failOn", async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({ failOn: 'off' }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.failOn).toBe('off')
  })

  test('loads rules with mixed severity values', async () => {
    writeFileSync(
      join(testDirectory, 'doctor.config.json'),
      JSON.stringify({
        rules: {
          'astro-doctor/no-set-html': 'error',
          'astro-doctor/use-astro-image': 'warn',
          'astro-doctor/no-missing-alt': 'off',
        },
      }),
    )
    const result = await loadConfig(testDirectory)
    expect(result?.rules?.['astro-doctor/no-set-html']).toBe('error')
    expect(result?.rules?.['astro-doctor/use-astro-image']).toBe('warn')
    expect(result?.rules?.['astro-doctor/no-missing-alt']).toBe('off')
  })
})
