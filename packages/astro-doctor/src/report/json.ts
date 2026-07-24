import { REPORT_SCHEMA_VERSION, SCORE_MODEL_VERSION } from '../constants.js'
import type { JsonReport, ProjectScanResult, ScanResult } from '../types.js'
import { getPackageVersion } from '../utils/get-package-version.js'

const SCHEMA_URL = 'https://doctor.santi020k.com/schema/report.json'

export const formatJsonReport = (
  result: ScanResult,
  directory: string,
  projects?: readonly ProjectScanResult[],
  scope: JsonReport['scope'] = 'full',
): JsonReport => ({
  $schema: SCHEMA_URL,
  schemaVersion: REPORT_SCHEMA_VERSION,
  version: getPackageVersion(),
  scoreModel: SCORE_MODEL_VERSION,
  timestamp: new Date().toISOString(),
  directory,
  scope,
  fileCount: result.fileCount,
  errorCount: result.errorCount,
  warningCount: result.warningCount,
  score: result.score,
  scoreLabel: result.scoreLabel,
  scoreBreakdown: result.scoreBreakdown,
  diagnostics: result.diagnostics,
  ...(projects && projects.length > 0
    ? {
        projects: projects.map((p) => ({
          name: p.name,
          directory: p.directory,
          fileCount: p.fileCount,
          errorCount: p.errorCount,
          warningCount: p.warningCount,
          score: p.score,
          scoreLabel: p.scoreLabel,
          scoreBreakdown: p.scoreBreakdown,
          diagnostics: p.diagnostics,
        })),
      }
    : {}),
})

export const serializeJsonReport = (report: JsonReport, compact: boolean): string =>
  compact ? JSON.stringify(report) : JSON.stringify(report, null, 2)
