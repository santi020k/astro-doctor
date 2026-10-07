import { parseForESLint } from 'astro-eslint-parser'
import type { Position } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

export const isFrontmatterPosition = (content: string, position: Position): boolean => {
  try {
    const frontmatter = parseForESLint(content).services.getAstroAst().frontmatter

    if (!frontmatter) return false

    const document = TextDocument.create('untitled:astro', 'astro', 0, content)
    const offset = document.offsetAt(position)
    const lineStart = document.offsetAt({ line: position.line, character: 0 })

    return lineStart >= frontmatter.program.start && offset < frontmatter.program.end
  } catch {
    return false
  }
}
