import { ESLint } from 'eslint'
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'
import * as astroParser from 'astro-eslint-parser'
import type { Diagnostic, ScanOptions, ScanResult, Severity } from '../types.js'
import { computeScore, computeScoreLabel } from '../scorer.js'
import { discoverAstroFiles } from './file-discovery.js'

const SEVERITY_MAP: Record<number, Severity> = {
  1: 'warning',
  2: 'error',
}

const RULE_CATEGORY_MAP: Record<string, string> = {
  'astro-doctor/use-astro-image': 'performance',
  'astro-doctor/no-client-load-overuse': 'performance',
  'astro-doctor/no-missing-alt': 'accessibility',
  'astro-doctor/no-set-html': 'security',
  'astro-doctor/prefer-class-list': 'best-practices',
}

const buildEslintConfig = (options: ScanOptions): ESLint.Options => ({
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
        ...astroDoctorPlugin.configs['recommended']?.rules,
        ...options.rules,
      },
    },
  ],
  ignore: false,
})

export const scan = async (options: ScanOptions): Promise<ScanResult> => {
  const astroFiles = await discoverAstroFiles(options.directory, options.ignore)

  if (astroFiles.length === 0) {
    return {
      diagnostics: [],
      fileCount: 0,
      errorCount: 0,
      warningCount: 0,
      score: 100,
      scoreLabel: 'A',
    }
  }

  const eslint = new ESLint(buildEslintConfig(options))
  const eslintResults = await eslint.lintFiles(astroFiles)

  const diagnostics: Diagnostic[] = []

  for (const fileResult of eslintResults) {
    for (const message of fileResult.messages) {
      if (!message.ruleId) continue

      const severity = SEVERITY_MAP[message.severity] ?? 'warning'
      const category = RULE_CATEGORY_MAP[message.ruleId] ?? 'best-practices'

      diagnostics.push({
        ruleId: message.ruleId,
        severity,
        message: message.message,
        filePath: fileResult.filePath,
        line: message.line,
        column: message.column,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: category as any,
      })
    }
  }

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
  const score = computeScore(errorCount, warningCount, astroFiles.length)
  const scoreLabel = computeScoreLabel(score)

  return {
    diagnostics,
    fileCount: astroFiles.length,
    errorCount,
    warningCount,
    score,
    scoreLabel,
  }
}
