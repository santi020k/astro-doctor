import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import type { AstroDoctorRule, RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'
import astroDoctorPlugin, {
  ASTRO_ESLINT_PLUGINS,
  getAstroRuleCategory,
} from '@santi020k/eslint-plugin-astro-doctor'

import * as astroParser from 'astro-eslint-parser'
import { ESLint } from 'eslint'

import { DEFAULT_CACHE_DIRECTORY_NAME, SCAN_DURATION_PRECISION_DIGITS } from '../constants.js'
import { getProjectRuleMeta } from '../project-rules.js'
import type { Diagnostic, ScanOptions, ScanResult, ScanTimings, Severity } from '../types.js'
import { createScanResult } from '../utils/create-scan-result.js'

import { discoverAstroFiles, resolveAstroFiles } from './file-discovery.js'
import { auditProject } from './project-audit.js'

const SEVERITY_MAP: Record<number, Severity> = {
  1: 'warning',
  2: 'error',
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
  scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 },
})

const collectEslintDiagnostics = (results: ESLint.LintResult[]): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []

  for (const fileResult of results) {
    for (const message of fileResult.messages) {
      if (!message.ruleId) continue

      const severity = SEVERITY_MAP[message.severity] ?? 'warning'
      const category = getRuleCategory(message.ruleId)

      diagnostics.push({
        ruleId: message.ruleId,
        severity,
        message: message.message,
        filePath: fileResult.filePath,
        line: message.line,
        column: message.column,
        category,
      })
    }
  }

  return diagnostics
}

const buildEslintConfig = (options: ScanOptions): ESLint.Options => {
  const pluginRules = options.rules
    ? Object.fromEntries(
        Object.entries(options.rules).filter(([ruleId]) => getProjectRuleMeta(ruleId) === undefined)
      )
    : {}

  const overrideConfigs = options.overrides?.map((override) => ({
    files: [...override.files],
    rules: override.rules,
  })) ?? []

  return {
    cwd: options.directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.astro'],
        plugins: {
          'astro-doctor': astroDoctorPlugin,
          ...ASTRO_ESLINT_PLUGINS,
        },
        languageOptions: {
          parser: astroParser,
          parserOptions: {
            sourceType: 'module',
          },
        },
        rules: {
          ...astroDoctorPlugin.configs.recommended?.rules,
          ...pluginRules,
        },
      },
      ...overrideConfigs,
    ],
    ignore: false,
    fix: options.fix,
    cache: options.cache,
    cacheLocation: join(options.directory, DEFAULT_CACHE_DIRECTORY_NAME),
    cacheStrategy: 'content',
    ...(options.noRespectInlineDisables ? { allowInlineConfig: false } : {}),
  }
}

const roundDuration = (durationMs: number): number =>
  Number(durationMs.toFixed(SCAN_DURATION_PRECISION_DIGITS))

export const scan = async (options: ScanOptions): Promise<ScanResult> => {
  const scanStartedAt = performance.now()
  const discoveryStartedAt = performance.now()

  const astroFiles = options.files
    ? resolveAstroFiles(options.directory, options.files)
    : await discoverAstroFiles(options.directory, options.ignore)

  const discoveryFinishedAt = performance.now()

  if (options.noLint) return EMPTY_RESULT(astroFiles.length)

  const auditStartedAt = performance.now()

  const projectDiagnostics = auditProject({
    directory: options.directory,
    files: options.files,
    rules: options.rules,
    astroFiles,
    ignore: options.ignore,
  })

  const auditFinishedAt = performance.now()

  if (astroFiles.length === 0 && projectDiagnostics.length === 0) return EMPTY_RESULT(0)

  const allDiagnostics: Diagnostic[] = []
  const lintStartedAt = performance.now()

  if (astroFiles.length > 0) {
    const eslint = new ESLint(buildEslintConfig(options))
    const eslintResults = await eslint.lintFiles(astroFiles)

    if (options.fix) await ESLint.outputFixes(eslintResults)

    allDiagnostics.push(...collectEslintDiagnostics(eslintResults))
  }

  const lintFinishedAt = performance.now()

  allDiagnostics.push(...projectDiagnostics)

  const { cache, categories } = options

  const diagnostics =
    categories && categories.length > 0
      ? allDiagnostics.filter((diagnostic) => categories.includes(diagnostic.category))
      : allDiagnostics

  const fileCount = new Set([
    ...astroFiles,
    ...diagnostics.map((diagnostic) => diagnostic.filePath),
  ]).size

  const timings: ScanTimings = {
    discoveryMs: roundDuration(discoveryFinishedAt - discoveryStartedAt),
    auditMs: roundDuration(auditFinishedAt - auditStartedAt),
    lintMs: roundDuration(lintFinishedAt - lintStartedAt),
    totalMs: roundDuration(performance.now() - scanStartedAt),
    cacheEnabled: Boolean(cache),
  }

  return {
    ...createScanResult(diagnostics, fileCount),
    timings,
  }
}
