import type { AstroAttributeNode } from './astro-ast.js'

export const getStaticAstroAttributeValue = (
  attributeNode: AstroAttributeNode | undefined
): string | boolean | number | null | undefined => {
  if (!attributeNode) return undefined

  if (attributeNode.staticValue !== undefined) return attributeNode.staticValue

  return attributeNode.kind === 'expression' ? undefined : attributeNode.value
}
