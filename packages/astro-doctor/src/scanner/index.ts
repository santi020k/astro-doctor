import type { AstroDoctorRule, RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

import * as astroParser from 'astro-eslint-parser'
import { ESLint } from 'eslint'

import { computeCategoryBreakdown, computeScore, computeScoreLabel } from '../scorer.js'
import type { Diagnostic, ScanOptions, ScanResult, Severity } from '../types.js'

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
  scoreLabel: 'A',
  scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 },
})

const buildEslintConfig = (options: ScanOptions): ESLint.Options => ({
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
        ...options.rules,
      },
    },
  ],
  ignore: false,
  // Audit mode: report all issues even when eslint-disable comments are present
  ...(options.noRespectInlineDisables ? { reportUnusedDisableDirectives: 'error' } : {}),
})

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

    for (const fileResult of eslintResults) {
      for (const message of fileResult.messages) {
        if (!message.ruleId) continue

        const severity = SEVERITY_MAP[message.severity] ?? 'warning'
        const category = getRuleCategory(message.ruleId)

        allDiagnostics.push({
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
  }

  allDiagnostics.push(...projectDiagnostics)

  const fileCount = new Set([
    ...astroFiles,
    ...allDiagnostics.map((diagnostic) => diagnostic.filePath),
  ]).size
  const score = computeScore(allDiagnostics, fileCount)
  const scoreLabel = computeScoreLabel(score)
  const scoreBreakdown = computeCategoryBreakdown(allDiagnostics, fileCount)

  const diagnostics =
    options.categories && options.categories.length > 0
      ? allDiagnostics.filter((d) => options.categories!.includes(d.category))
      : allDiagnostics

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length

  return {
    diagnostics,
    fileCount,
    errorCount,
    warningCount,
    score,
    scoreLabel,
    scoreBreakdown,
  }
}
