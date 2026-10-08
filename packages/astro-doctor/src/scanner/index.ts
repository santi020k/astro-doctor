import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { performance } from 'node:perf_hooks'

import type { AstroDoctorRule, RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'
import astroDoctorPlugin, {
  ASTRO_ESLINT_PLUGINS,
  getAstroRuleCategory
} from '@santi020k/eslint-plugin-astro-doctor'

import * as typescriptParser from '@typescript-eslint/parser'
import * as astroParser from 'astro-eslint-parser'
import { ESLint } from 'eslint'

import { DEFAULT_CACHE_DIRECTORY_NAME, SCAN_DURATION_PRECISION_DIGITS } from '../constants.js'
import { getProjectRuleMeta } from '../project-rules.js'
import type { Diagnostic, FixPreview, ScanOptions, ScanResult, ScanTimings, Severity } from '../types.js'
import { createScanResult } from '../utils/create-scan-result.js'
import { formatFixDiff } from '../utils/format-fix-diff.js'

import { discoverAstroFiles, resolveAstroFiles } from './file-discovery.js'
import { auditProject } from './project-audit.js'

const SEVERITY_MAP: Record<number, Severity> = {
  1: 'warning',
  2: 'error'
}

const getRuleCategory = (ruleId: string): RuleCategory => {
  const ecosystemCategory = getAstroRuleCategory(ruleId)

  if (ecosystemCategory !== undefined) return ecosystemCategory

  const shortName = ruleId.replace('astro-doctor/', '')
  const rule = astroDoctorPlugin.rules[shortName] as AstroDoctorRule | undefined

  return rule?.meta.docs.category ?? 'best-practices'
}

const EMPTY_RESULT = (fileCount = 0): ScanResult => ({
  diagnostics: [],
  fileCount,
  errorCount: 0,
  warningCount: 0,
  score: 100,
  scoreLabel: 'S',
  scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 }
})

const isConfiguredRule = (ruleId: string): boolean => {
  if (getAstroRuleCategory(ruleId) !== undefined) return true

  const shortName = ruleId.replace('astro-doctor/', '')

  return ruleId.startsWith('astro-doctor/') && astroDoctorPlugin.rules[shortName] !== undefined
}

const collectEslintDiagnostics = (results: ESLint.LintResult[]): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []

  for (const fileResult of results) {
    for (const message of fileResult.messages) {
      if (!message.ruleId || !isConfiguredRule(message.ruleId)) continue

      const severity = SEVERITY_MAP[message.severity] ?? 'warning'
      const category = getRuleCategory(message.ruleId)

      diagnostics.push({
        ruleId: message.ruleId,
        severity,
        message: message.message,
        filePath: fileResult.filePath,
        line: message.line,
        column: message.column,
        category
      })
    }
  }

  return diagnostics
}

export const buildEslintConfig = (options: ScanOptions): ESLint.Options => {
  const pluginRules = options.rules ?
    Object.fromEntries(
      Object.entries(options.rules).filter(([ruleId]) => getProjectRuleMeta(ruleId) === undefined)
    ) :
    {}

  const overrideConfigs = options.overrides?.map(override => ({
    files: [...override.files],
    rules: override.rules
  })) ?? []

  return {
    cwd: options.directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.astro'],
        plugins: {
          'astro-doctor': astroDoctorPlugin,
          ...ASTRO_ESLINT_PLUGINS
        },
        languageOptions: {
          parser: astroParser,
          parserOptions: {
            sourceType: 'module',
            parser: typescriptParser,
            extraFileExtensions: ['.astro']
          }
        },
        rules: {
          ...astroDoctorPlugin.configs.recommended?.rules,
          ...pluginRules
        }
      },
      ...overrideConfigs
    ],
    ignore: false,
    fix: Boolean(options.fix) || Boolean(options.fixDryRun),
    cache: options.fixDryRun ? false : options.cache,
    cacheLocation: join(options.directory, DEFAULT_CACHE_DIRECTORY_NAME),
    cacheStrategy: 'content',
    ...(options.noRespectInlineDisables ? { allowInlineConfig: false } : {})
  }
}

const roundDuration = (durationMs: number): number => Number(durationMs.toFixed(SCAN_DURATION_PRECISION_DIGITS))

const lintAstroFiles = async (options: ScanOptions, astroFiles: string[], projectDiagnostics: Diagnostic[]) => {
  let fixPreview: FixPreview | undefined
  const eslint = new ESLint(buildEslintConfig(options))

  const originalDiagnostics = options.fixDryRun ?
    collectEslintDiagnostics(await new ESLint(buildEslintConfig({
      ...options, fix: false, fixDryRun: false, cache: false
    })).lintFiles(astroFiles)) :
    []

  const eslintResults = await eslint.lintFiles(astroFiles)
  const invalidFile = eslintResults.find(fileResult => fileResult.fatalErrorCount > 0)

  if (invalidFile !== undefined) {
    throw new Error(`Cannot scan ${invalidFile.filePath}: source could not be parsed.`)
  }

  if (options.fixDryRun) {
    const changes = eslintResults.flatMap(fileResult => {
      if (fileResult.output === undefined) return []

      const original = readFileSync(fileResult.filePath, 'utf8')

      if (original === fileResult.output) return []

      return [{
        filePath: fileResult.filePath,
        diff: formatFixDiff(relative(options.directory, fileResult.filePath).replaceAll('\\', '/'), original, fileResult.output)
      }]
    })

    const remainingDiagnostics = collectEslintDiagnostics(eslintResults)

    fixPreview = {
      changes,
      fixedCount: Math.max(0, originalDiagnostics.length - remainingDiagnostics.length),
      remainingCount: remainingDiagnostics.length + projectDiagnostics.length
    }
  }

  if (options.fix) await ESLint.outputFixes(eslintResults)

  return { diagnostics: collectEslintDiagnostics(eslintResults), fixPreview }
}

const validateScanOptions = (options: ScanOptions): void => {
  if (!options.fixDryRun) return

  if (options.fix || options.noLint || (options.categories?.length ?? 0) > 0) {
    throw new Error('--fix-dry-run cannot be combined with --fix, --no-lint, or category filters.')
  }
}

export const scan = async (options: ScanOptions): Promise<ScanResult> => {
  validateScanOptions(options)

  const scanStartedAt = performance.now()
  const discoveryStartedAt = performance.now()

  const astroFiles = options.files ?
    resolveAstroFiles(options.directory, options.files) :
    await discoverAstroFiles(options.directory, options.ignore)

  const discoveryFinishedAt = performance.now()

  if (options.noLint) return EMPTY_RESULT(astroFiles.length)

  const auditStartedAt = performance.now()

  const projectDiagnostics = auditProject({
    directory: options.directory,
    files: options.files,
    rules: options.rules,
    astroFiles,
    ignore: options.ignore
  })

  const auditFinishedAt = performance.now()
  const allDiagnostics: Diagnostic[] = []

  let fixPreview: FixPreview | undefined = options.fixDryRun ?
    {
      changes: [], fixedCount: 0, remainingCount: projectDiagnostics.length
    } :
    undefined

  const lintStartedAt = performance.now()

  if (astroFiles.length > 0) {
    const lintResult = await lintAstroFiles(options, astroFiles, projectDiagnostics)

    allDiagnostics.push(...lintResult.diagnostics)

    fixPreview = lintResult.fixPreview
  }

  const lintFinishedAt = performance.now()

  allDiagnostics.push(...projectDiagnostics)

  const { categories } = options
  const cache = options.fixDryRun ? false : options.cache

  const diagnostics =
    categories && categories.length > 0 ?
      allDiagnostics.filter(diagnostic => categories.includes(diagnostic.category)) :
      allDiagnostics

  const fileCount = new Set([
    ...astroFiles,
    ...diagnostics.map(diagnostic => diagnostic.filePath)
  ]).size

  const timings: ScanTimings = {
    discoveryMs: roundDuration(discoveryFinishedAt - discoveryStartedAt),
    auditMs: roundDuration(auditFinishedAt - auditStartedAt),
    lintMs: roundDuration(lintFinishedAt - lintStartedAt),
    totalMs: roundDuration(performance.now() - scanStartedAt),
    cacheEnabled: Boolean(cache)
  }

  return {
    ...createScanResult(diagnostics, fileCount),
    timings,
    ...(fixPreview === undefined ? {} : { fixPreview })
  }
}
