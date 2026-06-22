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
  /** Filter results to only these categories. When empty/undefined all categories are shown. */
  readonly categories?: readonly RuleCategory[]
  /** When true, skip lint entirely and return a clean result. */
  readonly noLint?: boolean
  /** When true, ignore eslint-disable comments (audit mode). */
  readonly noRespectInlineDisables?: boolean
}

/** A single project's scan result within a multi-project run. */
export interface ProjectScanResult extends ScanResult {
  /** Display name of the project (package name or path). */
  readonly name: string
  /** Absolute path to the project root. */
  readonly directory: string
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
  /** Present when --project was used: per-project breakdown. */
  readonly projects?: readonly ProjectJsonEntry[]
}

/** Per-project entry in the JSON report's projects array. */
export interface ProjectJsonEntry {
  readonly name: string
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
  readonly preset?: 'recommended' | 'strict' | 'ci'
  readonly rules?: Record<string, 'error' | 'warn' | 'off'>
  readonly ignore?: readonly string[]
  readonly failOn?: 'error' | 'warning' | 'off'
  /** Exit 1 when the health score falls below this value (0–100). */
  readonly threshold?: number
  /**
   * Workspace projects to scan with --project.
   * Each entry is a package name or a relative path from the project root.
   * Overridden by the --project CLI flag.
   */
  readonly projects?: readonly string[]
}
