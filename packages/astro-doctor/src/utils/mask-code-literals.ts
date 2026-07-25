const CODE_LITERAL_PATTERN =
  /'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gu

const maskLiteral = (literal: string): string =>
  literal.replaceAll(/[^\r\n]/gu, (character) => ' '.repeat(character.length))

export const maskCodeLiterals = (content: string): string =>
  content.replaceAll(CODE_LITERAL_PATTERN, maskLiteral)
