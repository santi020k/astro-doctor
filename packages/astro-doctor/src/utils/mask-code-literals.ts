const CODE_LITERAL_PATTERN =
  /'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gu

const CODE_COMMENT_PATTERN = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gu
const REGEX_PREFIX_CHARACTERS = new Set('([{,:;=!?&|+-*%^~<>')

const REGEX_PREFIX_KEYWORDS = new Set([
  'await',
  'case',
  'delete',
  'do',
  'else',
  'in',
  'instanceof',
  'new',
  'of',
  'return',
  'throw',
  'typeof',
  'void',
  'yield'
])

const maskLiteral = (literal: string): string => literal.replaceAll(/[^\r\n]/gu, character => ' '.repeat(character.length))

export const maskCodeComments = (content: string): string => content.replaceAll(
  CODE_COMMENT_PATTERN, maskLiteral
)

const findPreviousNonWhitespaceIndex = (content: string, startIndex: number): number => {
  for (let characterIndex = startIndex; characterIndex >= 0; characterIndex -= 1) {
    if (!/\s/u.test(content[characterIndex] ?? '')) return characterIndex
  }

  return -1
}

const getPreviousWord = (content: string, endIndex: number): string => {
  let startIndex = endIndex

  while (startIndex >= 0 && /[A-Za-z]/u.test(content[startIndex] ?? '')) {
    startIndex -= 1
  }

  return content.slice(startIndex + 1, endIndex + 1)
}

const isRegexLiteralStart = (content: string, slashIndex: number): boolean => {
  const previousIndex = findPreviousNonWhitespaceIndex(content, slashIndex - 1)

  if (previousIndex < 0) return true

  const previousCharacter = content[previousIndex] ?? ''

  return REGEX_PREFIX_CHARACTERS.has(previousCharacter) ||
    REGEX_PREFIX_KEYWORDS.has(getPreviousWord(content, previousIndex))
}

const getRegexLiteralEndIndex = (content: string, slashIndex: number): number | undefined => {
  const regexLiteralMatch = /^\/(?:\\[\s\S]|\[(?:\\[\s\S]|[^\]\\\r\n])*\]|[^/\\[\r\n])+\/[A-Za-z]*/u.exec(
    content.slice(slashIndex)
  )

  return regexLiteralMatch === null ? undefined : slashIndex + regexLiteralMatch[0].length
}

const maskRegexLiterals = (content: string): string => {
  let lastUnmaskedIndex = 0
  let maskedContent = ''

  for (let characterIndex = 0; characterIndex < content.length; characterIndex += 1) {
    if (content[characterIndex] !== '/' || !isRegexLiteralStart(content, characterIndex)) continue

    const endIndex = getRegexLiteralEndIndex(content, characterIndex)

    if (endIndex === undefined) continue

    maskedContent += content.slice(lastUnmaskedIndex, characterIndex)

    maskedContent += maskLiteral(content.slice(characterIndex, endIndex))

    lastUnmaskedIndex = endIndex

    characterIndex = endIndex - 1
  }

  return maskedContent + content.slice(lastUnmaskedIndex)
}

export const maskCodeLiterals = (content: string): string => maskRegexLiterals(
  content.replaceAll(CODE_LITERAL_PATTERN, maskLiteral)
)
