import type { AstroDoctorRule, RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

import * as astroParser from 'astro-eslint-parser'
import { ESLint } from 'eslint'

import { getProjectRuleMeta } from '../project-rules.js'
import type { Diagnostic, ScanOptions, ScanResult, Severity } from '../types.js'
import { createScanResult } from '../utils/create-scan-result.js'

import { discoverAstroFiles, resolveAstroFiles } from './file-discovery.js'
import { auditProject } from './project-audit.js'

const SEVERITY_MAP: Record<number, Severity> = {
  1: 'warning',
  2: 'error',
}

const getRuleCategory = (ruleId: string): RuleCategory => {
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

  return {
    cwd: options.directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.astro'],
        plugins: {
          'astro-doctor': astroDoctorPlugin,
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
    ],
    ignore: false,
    fix: options.fix,
    ...(options.noRespectInlineDisables ? { allowInlineConfig: false } : {}),
  }
}

export const scan = async (options: ScanOptions): Promise<ScanResult> => {
  const astroFiles = options.files
    ? resolveAstroFiles(options.directory, options.files)
    : await discoverAstroFiles(options.directory, options.ignore)

  if (options.noLint) return EMPTY_RESULT(astroFiles.length)

  const projectDiagnostics = auditProject({
    directory: options.directory,
    files: options.files,
    rules: options.rules,
  })

  if (astroFiles.length === 0 && projectDiagnostics.length === 0) return EMPTY_RESULT(0)

  const allDiagnostics: Diagnostic[] = []

  if (astroFiles.length > 0) {
    const eslint = new ESLint(buildEslintConfig(options))
    const eslintResults = await eslint.lintFiles(astroFiles)

    if (options.fix) await ESLint.outputFixes(eslintResults)

    allDiagnostics.push(...collectEslintDiagnostics(eslintResults))
  }

  allDiagnostics.push(...projectDiagnostics)

  const { categories } = options

  const diagnostics =
    categories && categories.length > 0
      ? allDiagnostics.filter((diagnostic) => categories.includes(diagnostic.category))
      : allDiagnostics

  const fileCount = new Set([
    ...astroFiles,
    ...diagnostics.map((diagnostic) => diagnostic.filePath),
  ]).size

  return createScanResult(diagnostics, fileCount)
}
