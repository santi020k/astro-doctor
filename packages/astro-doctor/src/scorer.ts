import type { ScoreLabel } from './types.js'

/**
 * Computes a health score (0–100) from error/warning counts and file count.
 *
 * Formula: start at 100, subtract (errors × 10 + warnings × 3) per file.
 * Clamped to [0, 100]. A single-file project with one error scores ≈ 90.
 */
export const computeScore = (errorCount: number, warningCount: number, fileCount: number): number => {
  if (fileCount === 0) return 100
  const penalty = (errorCount * 10 + warningCount * 3) / fileCount
  return Math.max(0, Math.min(100, Math.round(100 - penalty)))
}

export const computeScoreLabel = (score: number): ScoreLabel => {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}
