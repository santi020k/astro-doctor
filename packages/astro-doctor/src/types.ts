import type { RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'

export type Severity = 'error' | 'warning'

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
}

export interface ScanOptions {
  readonly directory: string
  readonly ignore?: readonly string[]
  readonly rules?: Record<string, 'error' | 'warn' | 'off'>
}
