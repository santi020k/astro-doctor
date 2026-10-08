import type { CodeAction, Diagnostic } from 'vscode-languageserver/node'
import { CodeActionKind } from 'vscode-languageserver/node'

import { getProjectRuleMeta } from '../project-rules.js'

import { isFrontmatterPosition } from './is-frontmatter-position.js'

export const getLineSuppressionAction = (
  documentUri: string,
  ruleId: string,
  diagnostic: Diagnostic,
  documentContent?: string
): CodeAction | undefined => {
  if (documentContent === undefined || getProjectRuleMeta(ruleId) !== undefined ||
    !isFrontmatterPosition(documentContent, diagnostic.range.start)) return undefined

  const line = diagnostic.range.start.line

  return {
    title: `Disable ${ruleId} for this line`,
    kind: CodeActionKind.QuickFix,
    diagnostics: [diagnostic],
    edit: {
      changes: {
        [documentUri]: [{
          range: { start: { line, character: 0 }, end: { line, character: 0 } },
          newText: `// eslint-disable-next-line ${ruleId}\n`
        }]
      }
    }
  }
}
