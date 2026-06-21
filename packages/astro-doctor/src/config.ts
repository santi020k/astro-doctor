import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
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
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

const loadJsonConfig = (filePath: string): AstroDoctorConfig => {
  const content = readFileSync(filePath, 'utf8')
  const parsed: unknown = JSON.parse(stripJsonComments(content))
  return parsed as AstroDoctorConfig
}

const loadEsmConfig = async (filePath: string): Promise<AstroDoctorConfig> => {
  const url = pathToFileURL(filePath).href
  const module_: { default?: AstroDoctorConfig } = await import(url)
  return module_.default ?? (module_ as unknown as AstroDoctorConfig)
}

const loadCjsConfig = (filePath: string): AstroDoctorConfig => {
  const require_ = createRequire(import.meta.url)
  return require_(filePath) as AstroDoctorConfig
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
