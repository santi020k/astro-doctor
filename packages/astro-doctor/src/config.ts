import { existsSync,readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { AstroDoctorConfig } from './types.js'

const CONFIG_FILE_NAMES = [
  'doctor.config.ts',
  'doctor.config.js',
  'doctor.config.mjs',
  'doctor.config.cjs',
  'doctor.config.json',
  'doctor.config.jsonc',
] as const

/**
 * Strips single-line (//) and block (/* *\/) comments from a JSON-like string
 * so JSONC files can be parsed with JSON.parse().
 */
const stripJsonComments = (content: string): string =>
  content
    .replaceAll(/\/\/[^\n]*/g, '')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Extracts an AstroDoctorConfig from an imported module value (unknown at runtime).
 * Handles both `export default config` and bare object exports.
 */
const extractConfig = (imported: unknown): AstroDoctorConfig => {
  if (!isPlainObject(imported)) {
    throw new TypeError('Config module must export a plain object')
  }

  // Handle ESM default export: `export default { ... }`
  const config = 'default' in imported ? imported.default : imported

  if (!isPlainObject(config)) {
    throw new TypeError('Config default export must be a plain object')
  }

  // At this point we have confirmed it is a plain object — cast is the standard
  // TypeScript pattern here since full runtime field-level validation is out of scope.
  return config
}

const loadJsonConfig = (filePath: string): AstroDoctorConfig => {
  const content = readFileSync(filePath, 'utf8')
  const parsed: unknown = JSON.parse(stripJsonComments(content))

  return extractConfig(parsed)
}

const loadEsmConfig = async (filePath: string): Promise<AstroDoctorConfig> => {
  const url = pathToFileURL(filePath).href
  // Dynamic import with a string expression yields `any`; assigning to `unknown`
  // forces us to narrow before use.
  const imported: unknown = await import(url)

  return extractConfig(imported)
}

const loadCjsConfig = (filePath: string): AstroDoctorConfig => {
  const require_ = createRequire(import.meta.url)
  // createRequire's call signature returns `any`; assign to unknown to narrow.
  const imported: unknown = require_(filePath)

  return extractConfig(imported)
}

/**
 * Finds and loads a doctor.config.* file from the given directory.
 * Supports .ts (requires tsx/ts-node), .js, .mjs, .cjs, .json, .jsonc.
 * Returns null if no config file is found.
 */
export const loadConfig = async (directory: string): Promise<AstroDoctorConfig | null> => {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(directory, fileName)

    if (!existsSync(filePath)) continue

    try {
      if (fileName.endsWith('.json') || fileName.endsWith('.jsonc')) {
        return loadJsonConfig(filePath)
      }

      if (fileName.endsWith('.cjs')) {
        return loadCjsConfig(filePath)
      }

      // .ts / .js / .mjs — works natively with ts-node/tsx; .ts needs a loader
      return await loadEsmConfig(filePath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      throw new Error(`Failed to load ${fileName}: ${message}`)
    }
  }

  return null
}
