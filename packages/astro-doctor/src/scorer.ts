import type { Diagnostic, ScoreBreakdown, ScoreLabel } from './types.js'

export const computeScore = (errorCount: number, warningCount: number, fileCount: number): number => {
  if (fileCount === 0) return 100

  const penalty = (errorCount * 10 + warningCount * 3) / fileCount

  return Math.max(0, Math.min(100, Math.round(100 - penalty)))
}

const computeScoreForCategory = (
  diagnostics: readonly Diagnostic[],
  category: Diagnostic['category'],
  fileCount: number,
): number => {
  const categoryDiagnostics = diagnostics.filter((diagnostic) => diagnostic.category === category)
  const errorCount = categoryDiagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const warningCount = categoryDiagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length

  return computeScore(errorCount, warningCount, fileCount)
}

export const computeCategoryBreakdown = (
  diagnostics: readonly Diagnostic[],
  fileCount: number,
): ScoreBreakdown => ({
  performance: computeScoreForCategory(diagnostics, 'performance', fileCount),
  accessibility: computeScoreForCategory(diagnostics, 'accessibility', fileCount),
  security: computeScoreForCategory(diagnostics, 'security', fileCount),
  'best-practices': computeScoreForCategory(diagnostics, 'best-practices', fileCount),
})

export const computeScoreLabel = (score: number): ScoreLabel => {
  if (score >= 90) return 'A'

  if (score >= 75) return 'B'

  if (score >= 60) return 'C'

  if (score >= 40) return 'D'

  return 'F'
}
