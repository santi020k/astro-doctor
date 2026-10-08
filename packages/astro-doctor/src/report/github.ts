import type { Diagnostic, ScanResult } from '../types.js'
import { escapeGithubCommandData } from '../utils/escape-github-command-data.js'
import { escapeGithubCommandProperty } from '../utils/escape-github-command-property.js'

/**
 * Formats diagnostics as GitHub Actions workflow commands so they appear as
 * inline annotations on pull request diffs.
 *
 * Spec: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#setting-an-error-message
 *
 * Format: ::<level> file=<path>,line=<line>,col=<col>,title=<ruleId>::<message>
 */
const formatAnnotation = (diagnostic: Diagnostic): string => {
  const level = diagnostic.severity === 'error' ? 'error' : 'warning'
  const ruleShortName = escapeGithubCommandProperty(diagnostic.ruleId.replace('astro-doctor/', ''))
  const escapedMessage = escapeGithubCommandData(diagnostic.message)
  const location = `file=${escapeGithubCommandProperty(diagnostic.filePath)},line=${diagnostic.line},col=${diagnostic.column}`

  return `::${level} ${location},title=${ruleShortName}::${escapedMessage}`
}

export const formatGithubReport = (result: ScanResult): string => result.diagnostics.length === 0 ? '' : result.diagnostics.map(diagnostic => formatAnnotation(diagnostic)).join('\n')
