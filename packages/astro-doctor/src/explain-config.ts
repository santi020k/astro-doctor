import { existsSync, statSync } from 'node:fs'
import { matchesGlob, relative, resolve } from 'node:path'

import { ESLint } from 'eslint'

import { buildIgnorePatterns, discoverAstroFiles } from './scanner/file-discovery.js'
import { buildEslintConfig } from './scanner/index.js'
import { isProjectAuditDiscoveryPath } from './scanner/project-audit.js'
import { isFileInDirectory } from './utils/is-file-in-directory.js'
import { isPlainObject } from './utils/is-plain-object.js'
import type { PresetName } from './presets.js'
import { getProjectRuleMeta } from './project-rules.js'
import type { AstroDoctorConfig } from './types.js'

interface ConfigExplanation {
  readonly directory: string
  readonly filePath: string
  readonly preset: PresetName
  readonly ignored: boolean
  readonly discoveryExcluded: boolean
  readonly ignorePatterns: readonly string[]
  readonly matchedOverrides: readonly number[]
  readonly rules: Record<string, 'error' | 'warn' | 'off'>
  readonly projectRules: Record<string, 'error' | 'warn' | 'off'>
}

const normalizeSeverity = (value: unknown): 'error' | 'warn' | 'off' => {
  const severity: unknown = Array.isArray(value) ? value[0] : value

  if (severity === 2 || severity === 'error') return 'error'

  return severity === 1 || severity === 'warn' ? 'warn' : 'off'
}

const getConfigRules = (config: unknown): Record<string, unknown> => {
  const configRules: unknown = isPlainObject(config) ? config.rules : undefined

  return isPlainObject(configRules) ? configRules : {}
}

const getMatchingIgnorePatterns = (
  directory: string, filePath: string, config: AstroDoctorConfig
): string[] => {
  const relativePath = relative(directory, filePath).replaceAll('\\', '/')

  return buildIgnorePatterns(config.ignore).filter(pattern => matchesGlob(relativePath, pattern))
}

const getMatchingOverrides = async (
  directory: string, filePath: string, config: AstroDoctorConfig
): Promise<number[]> => {
  const matches: number[] = []

  for (const [overrideIndex, override] of (config.overrides ?? []).entries()) {
    const probe = new ESLint({
      cwd: directory,
      overrideConfigFile: true,
      overrideConfig: [{ files: [...override.files], rules: { 'no-debugger': 'off' } }],
      ignore: false
    })

    const matchingConfig: unknown = await probe.calculateConfigForFile(filePath)

    if (getConfigRules(matchingConfig)['no-debugger'] !== undefined) matches.push(overrideIndex)
  }

  return matches
}

const isDiscoveryExcluded = async (
  directory: string, filePath: string, config: AstroDoctorConfig
): Promise<boolean> => {
  if (!filePath.endsWith('.astro')) return !isProjectAuditDiscoveryPath(directory, filePath, config.ignore)

  const discoveredFiles = await discoverAstroFiles(directory, config.ignore)

  return !discoveredFiles.includes(filePath)
}

export const explainConfig = async (
  filePath: string,
  directory: string,
  config: AstroDoctorConfig,
  preset: PresetName
): Promise<ConfigExplanation> => {
  const absolutePath = resolve(directory, filePath)

  if (!isFileInDirectory(absolutePath, directory) || !existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new Error('explain-config requires an existing file inside the selected project.')
  }

  const discoveryExcluded = await isDiscoveryExcluded(directory, absolutePath, config)
  const isAstroFile = absolutePath.endsWith('.astro')
  const ignorePatterns = isAstroFile ? getMatchingIgnorePatterns(directory, absolutePath, config) : []
  const eslint = new ESLint(buildEslintConfig({ directory, rules: config.rules, overrides: config.overrides }))
  const effectiveConfig: unknown = isAstroFile ? await eslint.calculateConfigForFile(absolutePath) : undefined

  const rules = Object.fromEntries(
    Object.entries(getConfigRules(effectiveConfig)).map(([ruleId, value]) => [ruleId, normalizeSeverity(value)])
  )

  const matchedOverrides = isAstroFile ? await getMatchingOverrides(directory, absolutePath, config) : []

  const projectRules = Object.fromEntries(
    Object.entries(config.rules ?? {}).filter(([ruleId]) => getProjectRuleMeta(ruleId) !== undefined)
  )

  return {
    directory,
    filePath: absolutePath,
    preset,
    ignored: ignorePatterns.length > 0 || discoveryExcluded,
    discoveryExcluded,
    ignorePatterns,
    matchedOverrides,
    rules,
    projectRules
  }
}

export const formatConfigExplanation = (explanation: ConfigExplanation): string => [
  `Configuration for ${explanation.filePath}`,
  `Project: ${explanation.directory}`,
  `Preset: ${explanation.preset}`,
  `Ignored: ${explanation.ignored ? 'yes' : 'no'}`,
  `Excluded by full-scan discovery: ${explanation.discoveryExcluded ? 'yes' : 'no'}`,
  `Matching ignore patterns: ${explanation.ignorePatterns.join(', ') || 'none'}`,
  `Matching overrides (zero-based, applied in order): ${explanation.matchedOverrides.join(', ') || 'none'}`,
  'Template rules:',
  ...Object.entries(explanation.rules).sort(([firstRule], [secondRule]) => firstRule.localeCompare(secondRule)).map(([ruleId, severity]) => `  ${severity}  ${ruleId}`),
  'Project audit rules (file overrides do not apply):',
  ...Object.entries(explanation.projectRules).sort(([firstRule], [secondRule]) => firstRule.localeCompare(secondRule)).map(([ruleId, severity]) => `  ${severity}  ${ruleId}`)
].join('\n')
