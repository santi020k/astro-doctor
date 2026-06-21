import type { Diagnostic, ScanResult } from '../types.js'

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
  const ruleShortName = diagnostic.ruleId.replace('astro-doctor/', '')
  // GitHub Actions annotation properties must not contain commas or newlines
  const escapedMessage = diagnostic.message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')

  return `::${level} file=${diagnostic.filePath},line=${diagnostic.line},col=${diagnostic.column},title=${ruleShortName}::${escapedMessage}`
}

export const formatGithubReport = (result: ScanResult): string => {
  if (result.diagnostics.length === 0) return ''

  return result.diagnostics.map((d) => formatAnnotation(d)).join('\n')
}
