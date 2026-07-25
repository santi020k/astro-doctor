import { computeCategoryBreakdown, computeScore, computeScoreLabel } from '../scorer.js'
import type { Diagnostic, ScanResult } from '../types.js'

export const createScanResult = (
  diagnostics: readonly Diagnostic[],
  fileCount: number,
): ScanResult => {
  const score = computeScore(diagnostics, fileCount)

  return {
    diagnostics,
    fileCount,
    errorCount: diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
    warningCount: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
    score,
    scoreLabel: computeScoreLabel(score),
    scoreBreakdown: computeCategoryBreakdown(diagnostics, fileCount),
  }
}
