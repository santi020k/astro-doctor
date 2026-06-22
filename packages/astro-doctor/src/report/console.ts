import { relative } from 'node:path'

import type { Diagnostic, ProjectScanResult, ScanResult } from '../types.js'

const useColor = (): boolean => process.stdout.isTTY && process.env.NO_COLOR === undefined
const ansi = (code: string) => (text: string) => useColor() ? `\x1b[${code}m${text}\x1b[0m` : text
const bold = ansi('1')
const dim = ansi('2')
const underline = ansi('4')
const red = ansi('31')
const yellow = ansi('33')
const green = ansi('32')
const cyan = ansi('36')
const magentaBright = ansi('95')

const SCORE_EMOJI: Record<string, string> = {
  A: '✅',
  B: '🟢',
  C: '🟡',
  D: '🟠',
  F: '🔴',
}

const colorScore = (score: number, label: string): string => {
  if (score === 100) return magentaBright(`${score}/100 (${label})`)

  if (score >= 90) return green(`${score}/100 (${label})`)

  if (score >= 75) return cyan(`${score}/100 (${label})`)

  if (score >= 60) return yellow(`${score}/100 (${label})`)

  return red(`${score}/100 (${label})`)
}

const PAD_LOCATION = 8

const formatDiagnosticRow = (diagnostic: Diagnostic): string => {
  const location = dim(`${diagnostic.line}:${diagnostic.column}`.padEnd(PAD_LOCATION))

  const severityText =
    diagnostic.severity === 'error'
      ? red('error  ')
      : yellow('warning')

  const ruleShortName = dim(`  (${diagnostic.ruleId.replace('astro-doctor/', '')})`)

  return `  ${location}  ${severityText}  ${diagnostic.message}${ruleShortName}`
}

const groupByFile = (diagnostics: readonly Diagnostic[]): Map<string, Diagnostic[]> => {
  const diagnosticsByFile = new Map<string, Diagnostic[]>()

  for (const diagnostic of diagnostics) {
    const existingDiagnostics = diagnosticsByFile.get(diagnostic.filePath)

    if (existingDiagnostics) {
      existingDiagnostics.push(diagnostic)
    } else {
      diagnosticsByFile.set(diagnostic.filePath, [diagnostic])
    }
  }

  return diagnosticsByFile
}

const formatFileGroup = (filePath: string, diagnostics: Diagnostic[], rootDirectory: string): string => {
  const relPath = relative(rootDirectory, filePath)
  const header = bold(underline(relPath))
  const rows = diagnostics.map((diagnostic) => formatDiagnosticRow(diagnostic)).join('\n')

  return `${header}\n${rows}`
}

const formatSummaryLine = (result: ScanResult): string => {
  const { errorCount, warningCount, fileCount } = result
  const totalIssues = errorCount + warningCount
  const errorLabel = errorCount === 1 ? '1 error' : `${errorCount} errors`
  const warningLabel = warningCount === 1 ? '1 warning' : `${warningCount} warnings`
  const summary = `${totalIssues} problems (${errorLabel}, ${warningLabel}) across ${fileCount} file${fileCount === 1 ? '' : 's'}`

  return totalIssues > 0 ? bold(red(`✖ ${summary}`)) : summary
}

const formatBreakdownLine = (result: ScanResult): string => {
  const { scoreBreakdown } = result

  const categories: [string, number][] = [
    ['perf', scoreBreakdown.performance],
    ['a11y', scoreBreakdown.accessibility],
    ['sec', scoreBreakdown.security],
    ['practices', scoreBreakdown['best-practices']],
  ]

  const parts = categories.map(([label, score]) => `${label}: ${colorScore(score, '')}`.replace(' ()', ''))

  return dim(`  ${parts.join('  ')}`)
}

const formatScoreLine = (result: ScanResult, showScore: boolean): string => {
  if (!showScore) return ''

  const emoji = SCORE_EMOJI[result.scoreLabel] ?? '🟡'
  const score = colorScore(result.score, result.scoreLabel)
  const breakdown = formatBreakdownLine(result)

  return `\nAstro Doctor Score: ${score} ${emoji}\n${breakdown}`
}

const RULE_DOCS: Record<string, string> = {
  'no-blocking-script': 'Performance · <script src> must use defer, async, or type="module"',
  'no-client-load-overuse': 'Performance · Prefer client:idle / client:visible over client:load',
  'use-astro-image': 'Performance · Use <Image> from astro:assets instead of raw <img>',
  'no-missing-alt': 'Accessibility · All images must have an alt attribute',
  'no-missing-lang': 'Accessibility · <html> must have a lang attribute',
  'no-set-html': 'Security · Avoid set:html to prevent XSS',
  'no-process-env': 'Best Practices · Use import.meta.env instead of process.env',
  'prefer-class-list': 'Best Practices · Use class:list for dynamic class names',
  'prefer-content-collections': 'Best Practices · Use getCollection() instead of Astro.glob()',
}

const formatVerboseRuleSummary = (diagnostics: readonly Diagnostic[]): string => {
  const countByRule = new Map<string, number>()

  for (const d of diagnostics) {
    const short = d.ruleId.replace('astro-doctor/', '')

    countByRule.set(short, (countByRule.get(short) ?? 0) + 1)
  }

  const lines = Object.entries(RULE_DOCS).map(([ruleId, doc]) => {
    const count = countByRule.get(ruleId) ?? 0
    const status = count === 0 ? green('✔') : red(`✖ ${count}`)

    return `  ${status}  ${dim(doc)}`
  })

  return `\nRule summary:\n${lines.join('\n')}`
}

export const formatScoreOnly = (result: ScanResult): string => String(result.score)

/**
 * Format a multi-project score table.
 * Shows one score line per project, then an aggregate worst-of line.
 */
export const formatProjectScoreTable = (
  projects: readonly ProjectScanResult[],
  aggregate: ScanResult,
  showScore: boolean,
): string => {
  if (!showScore || projects.length === 0) return ''

  const PAD_NAME = Math.max(...projects.map((p) => p.name.length), 12)

  const lines = projects.map((p) => {
    const emoji = SCORE_EMOJI[p.scoreLabel] ?? '🟡'
    const nameCol = p.name.padEnd(PAD_NAME)
    const issueCount = p.errorCount + p.warningCount
    const issueLabel = issueCount === 0 ? green('no issues') : red(`${issueCount} issue${issueCount === 1 ? '' : 's'}`)

    return `  ${nameCol}  ${colorScore(p.score, p.scoreLabel)} ${emoji}  ${issueLabel}`
  })

  const aggregateEmoji = SCORE_EMOJI[aggregate.scoreLabel] ?? '🟡'
  const aggregateLine = `  ${'aggregate'.padEnd(PAD_NAME)}  ${colorScore(aggregate.score, aggregate.scoreLabel)} ${aggregateEmoji}  ${dim('(worst-of)')}`

  return `\nProject scores:\n${lines.join('\n')}\n${dim('─'.repeat(PAD_NAME + 30))}\n${aggregateLine}\n`
}

export const formatConsoleReport = (
  result: ScanResult,
  rootDirectory = process.cwd(),
  showScore = true,
  verbose = false,
): string => {
  const scoreLine = formatScoreLine(result, showScore)
  const verboseSummary = verbose ? formatVerboseRuleSummary(result.diagnostics) : ''

  if (result.diagnostics.length === 0) {
    const fileLabel = result.fileCount === 1 ? '1 file' : `${result.fileCount} files`

    return `\n${green('✔')} No issues found across ${fileLabel}. Your Astro is healthy!${verboseSummary}${scoreLine}\n`
  }

  const grouped = groupByFile(result.diagnostics)

  const fileBlocks = [...grouped.entries()]
    .map(([filePath, diagnostics]) => formatFileGroup(filePath, diagnostics, rootDirectory))
    .join('\n\n')

  const summaryLine = formatSummaryLine(result)

  return `\n${fileBlocks}\n\n${summaryLine}${verboseSummary}${scoreLine}\n`
}
