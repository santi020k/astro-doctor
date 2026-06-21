import { relative } from 'node:path'
import type { ScanResult, Diagnostic } from '../types.js'

const SEVERITY_LABEL: Record<string, string> = {
  error: 'error',
  warning: 'warning',
}

const formatDiagnosticLine = (diagnostic: Diagnostic, rootDirectory: string): string => {
  const relativeFilePath = relative(rootDirectory, diagnostic.filePath)
  const location = `${diagnostic.line}:${diagnostic.column}`
  const severity = SEVERITY_LABEL[diagnostic.severity] ?? 'warning'
  const ruleShortName = diagnostic.ruleId.replace('astro-doctor/', '')

  return `  ${relativeFilePath}  ${location}  ${severity}  ${diagnostic.message}  (${ruleShortName})`
}

const formatSummaryLine = (result: ScanResult): string => {
  const { errorCount, warningCount, fileCount } = result

  const totalIssues = errorCount + warningCount
  const errorLabel = errorCount === 1 ? '1 error' : `${errorCount} errors`
  const warningLabel = warningCount === 1 ? '1 warning' : `${warningCount} warnings`

  return `${totalIssues} problems (${errorLabel}, ${warningLabel}) across ${fileCount} file${fileCount === 1 ? '' : 's'}`
}

export const formatConsoleReport = (result: ScanResult, rootDirectory = process.cwd()): string => {
  if (result.diagnostics.length === 0) {
    return `\nNo issues found across ${result.fileCount} file${result.fileCount === 1 ? '' : 's'}. Your Astro is healthy!\n`
  }

  const diagnosticLines = result.diagnostics
    .map((diagnostic) => formatDiagnosticLine(diagnostic, rootDirectory))
    .join('\n')

  const summaryLine = formatSummaryLine(result)

  return `\n${diagnosticLines}\n\n${summaryLine}\n`
}
