export { loadConfig } from './config.js'
export { formatConsoleReport, formatJsonReport, formatSarifReport } from './report/index.js'
export type { SarifReport } from './report/sarif.js'
export { scan } from './scanner/index.js'
export { computeScore, computeScoreLabel } from './scorer.js'
export type {
  AstroDoctorConfig,
  Diagnostic,
  JsonReport,
  ScanOptions,
  ScanResult,
  ScanTimings,
  ScoreLabel,
  Severity,
} from './types.js'
