import { FIX_DIFF_CONTEXT_LINES } from '../constants.js'

const formatLine = (line: string, prefix: string): string => line.endsWith('\n') ?
  `${prefix}${line.slice(0, -1)}` :
  `${prefix}${line}\n\\ No newline at end of file`

interface SharedLines {
  readonly prefixLength: number
  readonly suffixLength: number
}

const getSharedLines = (originalLines: string[], fixedLines: string[]): SharedLines => {
  let prefixLength = 0

  while (
    prefixLength < originalLines.length && prefixLength < fixedLines.length &&
    originalLines[prefixLength] === fixedLines[prefixLength]
  ) {
    prefixLength++
  }

  let suffixLength = 0

  while (
    suffixLength < originalLines.length - prefixLength && suffixLength < fixedLines.length - prefixLength &&
    originalLines.at(-suffixLength - 1) === fixedLines.at(-suffixLength - 1)
  ) {
    suffixLength++
  }

  return { prefixLength, suffixLength }
}

export const formatFixDiff = (filePath: string, original: string, fixed: string): string => {
  const originalLines = original.match(/[^\n]*\n|[^\n]+$/gu) ?? []
  const fixedLines = fixed.match(/[^\n]*\n|[^\n]+$/gu) ?? []
  const { prefixLength, suffixLength } = getSharedLines(originalLines, fixedLines)
  const start = Math.max(0, prefixLength - FIX_DIFF_CONTEXT_LINES)
  const originalEnd = Math.min(originalLines.length, originalLines.length - suffixLength + FIX_DIFF_CONTEXT_LINES)
  const fixedEnd = Math.min(fixedLines.length, fixedLines.length - suffixLength + FIX_DIFF_CONTEXT_LINES)
  const contextBefore = originalLines.slice(start, prefixLength).map(line => formatLine(line, ' '))
  const removed = originalLines.slice(prefixLength, originalLines.length - suffixLength).map(line => formatLine(line, '-'))
  const added = fixedLines.slice(prefixLength, fixedLines.length - suffixLength).map(line => formatLine(line, '+'))
  const contextAfter = originalLines.slice(originalLines.length - suffixLength, originalEnd).map(line => formatLine(line, ' '))
  const originalStart = originalEnd === start ? start : start + 1
  const fixedStart = fixedEnd === start ? start : start + 1

  return [
    `--- ${JSON.stringify(`a/${filePath}`)}`,
    `+++ ${JSON.stringify(`b/${filePath}`)}`,
    `@@ -${originalStart},${originalEnd - start} +${fixedStart},${fixedEnd - start} @@`,
    ...contextBefore,
    ...removed,
    ...added,
    ...contextAfter
  ].join('\n')
}
