import type { JsonReport, ScanResult } from '../types.js'

const PACKAGE_VERSION = '0.1.0'
const SCHEMA_URL = 'https://astro.doctor/schema/config.json'

export const formatJsonReport = (result: ScanResult, directory: string): JsonReport => ({
  $schema: SCHEMA_URL,
  version: PACKAGE_VERSION,
  timestamp: new Date().toISOString(),
  directory,
  fileCount: result.fileCount,
  errorCount: result.errorCount,
  warningCount: result.warningCount,
  score: result.score,
  scoreLabel: result.scoreLabel,
  diagnostics: result.diagnostics,
})
