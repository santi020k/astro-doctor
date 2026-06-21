import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseJSON5 } from 'confbox'
import { createJiti } from 'jiti'

import { isPresetName } from './presets.js'
import type { AstroDoctorConfig } from './types.js'

const CONFIG_FILE_NAMES = [
  'doctor.config.ts',
  'doctor.config.js',
  'doctor.config.mjs',
  'doctor.config.cjs',
  'doctor.config.json',
  'doctor.config.jsonc',
] as const

const jiti = createJiti(import.meta.url)

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const VALID_FAIL_ON = new Set(['error', 'warning', 'off'])
const VALID_RULE_VALUES = new Set(['error', 'warn', 'off'])

const isFailOnValue = (value: unknown): value is NonNullable<AstroDoctorConfig['failOn']> =>
  typeof value === 'string' && VALID_FAIL_ON.has(value)

const isRuleSeverity = (
  value: unknown,
): value is NonNullable<AstroDoctorConfig['rules']>[string] =>
  typeof value === 'string' && VALID_RULE_VALUES.has(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isRulesConfig = (value: unknown): value is NonNullable<AstroDoctorConfig['rules']> => {
  if (!isPlainObject(value)) return false

  return Object.values(value).every((ruleValue) => isRuleSeverity(ruleValue))
}

const describeConfigValue = (value: unknown): string => {
  if (typeof value === 'string') return value

  if (typeof value === 'number' || typeof value === 'boolean') return `${value}`

  if (value === null) return 'null'

  if (value === undefined) return 'undefined'

  return JSON.stringify(value)
}

const validateFailOn = (failOn: unknown): AstroDoctorConfig['failOn'] => {
  if (failOn === undefined) return undefined

  if (isFailOnValue(failOn)) return failOn

  throw new Error(
    `Invalid failOn value "${describeConfigValue(failOn)}". Expected "error", "warning", or "off".`,
  )
}

const validatePreset = (preset: unknown): AstroDoctorConfig['preset'] => {
  if (preset === undefined) return undefined

  if (isPresetName(preset)) return preset

  throw new Error(
    `Invalid preset value "${describeConfigValue(preset)}". Expected "recommended", "strict", or "ci".`,
  )
}

const validateThreshold = (threshold: unknown): AstroDoctorConfig['threshold'] => {
  if (threshold === undefined) return undefined

  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
    throw new TypeError(
      `Invalid threshold: expected a number 0–100, got "${describeConfigValue(threshold)}".`,
    )
  }

  if (threshold < 0 || threshold > 100) {
    throw new RangeError(`threshold must be between 0 and 100, got ${threshold}.`)
  }

  return threshold
}

const validateIgnore = (ignore: unknown): AstroDoctorConfig['ignore'] => {
  if (ignore === undefined) return undefined

  if (isStringArray(ignore)) return ignore

  throw new TypeError('Config ignore must be an array of glob strings.')
}

const validateRules = (rules: unknown): AstroDoctorConfig['rules'] => {
  if (rules === undefined) return undefined

  if (!isPlainObject(rules)) {
    throw new TypeError('Config rules must be a plain object.')
  }

  for (const [ruleId, ruleValue] of Object.entries(rules)) {
    if (!isRuleSeverity(ruleValue)) {
      throw new Error(
        `Invalid rule value for "${ruleId}": "${describeConfigValue(ruleValue)}". Expected "error", "warn", or "off".`,
      )
    }
  }

  return isRulesConfig(rules) ? rules : undefined
}

const validateConfig = (config: Record<string, unknown>): AstroDoctorConfig => {
  const preset = validatePreset(config.preset)
  const failOn = validateFailOn(config.failOn)
  const threshold = validateThreshold(config.threshold)
  const ignore = validateIgnore(config.ignore)
  const rules = validateRules(config.rules)

  return {
    ...(preset === undefined ? {} : { preset }),
    ...(failOn === undefined ? {} : { failOn }),
    ...(threshold === undefined ? {} : { threshold }),
    ...(ignore === undefined ? {} : { ignore }),
    ...(rules === undefined || !isRulesConfig(rules) ? {} : { rules }),
  }
}

const extractConfig = (imported: unknown): AstroDoctorConfig => {
  if (!isPlainObject(imported)) {
    throw new TypeError('Config module must export a plain object')
  }

  const config = 'default' in imported ? imported.default : imported

  if (!isPlainObject(config)) {
    throw new TypeError('Config default export must be a plain object')
  }

  return validateConfig(config)
}

const loadJsonConfig = (filePath: string): AstroDoctorConfig => {
  const content = readFileSync(filePath, 'utf8')
  const parsed: unknown = parseJSON5(content)

  return extractConfig(parsed)
}

const loadModuleConfig = async (filePath: string): Promise<AstroDoctorConfig> => {
  const imported: unknown = await jiti.import(filePath)

  return extractConfig(imported)
}

export const loadConfig = async (directory: string): Promise<AstroDoctorConfig | null> => {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(directory, fileName)

    if (!existsSync(filePath)) continue

    try {
      if (fileName.endsWith('.json') || fileName.endsWith('.jsonc')) {
        return loadJsonConfig(filePath)
      }

      return await loadModuleConfig(filePath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      throw new Error(`Failed to load ${fileName}: ${message}`, { cause: error })
    }
  }

  return null
}
