import type { RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'

export type Severity = 'error' | 'warning'

/** Per-category health scores (0–100 each, same scale as the overall score). */
export interface ScoreBreakdown {
  readonly performance: number
  readonly accessibility: number
  readonly security: number
  readonly 'best-practices': number
}

/** Letter grade for the health score (A = 90–100, B = 75–89, C = 60–74, D = 40–59, F = 0–39) */
export type ScoreLabel = 'A' | 'B' | 'C' | 'D' | 'F'

export interface Diagnostic {
  readonly ruleId: string
  readonly severity: Severity
  readonly message: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly category: RuleCategory
}

export interface ScanResult {
  readonly diagnostics: readonly Diagnostic[]
  readonly fileCount: number
  readonly errorCount: number
  readonly warningCount: number
  /** Health score 0–100. Penalizes errors (×10) and warnings (×3) per file. */
  readonly score: number
  readonly scoreLabel: ScoreLabel
  /** Per-category health scores using the same penalty formula as the overall score. */
  readonly scoreBreakdown: ScoreBreakdown
}

export interface ScanOptions {
  readonly directory: string
  readonly files?: readonly string[]
  readonly ignore?: readonly string[]
  readonly rules?: Record<string, 'error' | 'warn' | 'off'>
}

/** Shape of the machine-readable JSON report written by --json */
export interface JsonReport {
  readonly $schema: string
  readonly version: string
  readonly timestamp: string
  readonly directory: string
  readonly fileCount: number
  readonly errorCount: number
  readonly warningCount: number
  readonly score: number
  readonly scoreLabel: ScoreLabel
  readonly scoreBreakdown: ScoreBreakdown
  readonly diagnostics: readonly Diagnostic[]
}

/** Shape of doctor.config.ts / doctor.config.json */
export interface AstroDoctorConfig {
  readonly rules?: Record<string, 'error' | 'warn' | 'off'>
  readonly ignore?: readonly string[]
  readonly failOn?: 'error' | 'warning' | 'off'
  /** Exit 1 when the health score falls below this value (0–100). */
  readonly threshold?: number
}
