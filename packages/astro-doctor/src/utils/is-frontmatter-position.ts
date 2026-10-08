import * as typescriptParser from '@typescript-eslint/parser'
import { parseForESLint } from 'astro-eslint-parser'
import type { Position } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

export const isFrontmatterPosition = (content: string, position: Position): boolean => {
  try {
    const parsedDocument = parseForESLint(content, {
      parser: typescriptParser,
      sourceType: 'module',
      extraFileExtensions: ['.astro']
    })

    const frontmatter = parsedDocument.services.getAstroAst().frontmatter

    if (!frontmatter) return false

    const document = TextDocument.create('untitled:astro', 'astro', 0, content)
    const offset = document.offsetAt(position)
    const lineStart = document.offsetAt({ line: position.line, character: 0 })

    const containsLineStart = [...parsedDocument.ast.tokens, ...parsedDocument.ast.comments]
      .some(token => token.range[0] < lineStart && token.range[1] > lineStart)

    return !containsLineStart && lineStart >= frontmatter.program.start && offset < frontmatter.program.end
  } catch {
    return false
  }
}
