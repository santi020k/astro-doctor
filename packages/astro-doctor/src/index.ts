export { loadConfig } from './config.js'
export { formatConsoleReport, formatJsonReport } from './report/index.js'
export { scan } from './scanner/index.js'
export { computeScore, computeScoreLabel } from './scorer.js'
export type {
  AstroDoctorConfig,
  Diagnostic,
  JsonReport,
  ScanOptions,
  ScanResult,
  ScoreLabel,
  Severity,
} from './types.js'
