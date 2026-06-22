import type { Diagnostic, ScoreBreakdown, ScoreLabel } from './types.js'

/**
 * Compute a health score (0–100) using per-file averaging.
 * Each file is scored independently (errors cost 25 pts, warnings cost 10 pts, clamped to [0,100]),
 * then the per-file scores are averaged. This prevents a single heavily-broken file from
 * dragging down the score of large, otherwise-clean projects beyond its actual impact.
 */
export const computeScore = (diagnostics: readonly Diagnostic[], fileCount: number): number => {
  if (fileCount === 0) return 100

  // Accumulate penalty per file path
  const penaltyByFile = new Map<string, number>()

  for (const diagnostic of diagnostics) {
    const existing = penaltyByFile.get(diagnostic.filePath) ?? 0

    penaltyByFile.set(diagnostic.filePath, existing + (diagnostic.severity === 'error' ? 25 : 10))
  }

  // Clean files (not in the map) score 100; dirty files are clamped to [0, 100]
  const cleanFileTotal = (fileCount - penaltyByFile.size) * 100
  let dirtyFileTotal = 0

  for (const penalty of penaltyByFile.values()) {
    dirtyFileTotal += Math.max(0, 100 - penalty)
  }

  const rawScore = Math.floor((cleanFileTotal + dirtyFileTotal) / fileCount)

  // Never return a perfect score if there are diagnostics
  if (diagnostics.length > 0 && rawScore === 100) {
    return 99
  }

  return rawScore
}

const computeScoreForCategory = (
  diagnostics: readonly Diagnostic[],
  category: Diagnostic['category'],
  fileCount: number,
): number => {
  const categoryDiagnostics = diagnostics.filter((diagnostic) => diagnostic.category === category)

  return computeScore(categoryDiagnostics, fileCount)
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
