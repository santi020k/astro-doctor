export { scan } from './scanner/index.js'
export { formatConsoleReport, formatJsonReport } from './report/index.js'
export { loadConfig } from './config.js'
export { computeScore, computeScoreLabel } from './scorer.js'
export type {
  Diagnostic,
  ScanResult,
  ScanOptions,
  Severity,
  ScoreLabel,
  JsonReport,
  AstroDoctorConfig,
} from './types.js'
