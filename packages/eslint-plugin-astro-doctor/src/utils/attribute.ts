import type { AstroAttributeNode } from './astro-ast.js'

export const hasAstroAttribute = (
  attributes: readonly AstroAttributeNode[],
  attributeName: string,
): boolean => attributes.some((attributeNode) => attributeNode.name === attributeName)

export const getAstroAttribute = (
  attributes: readonly AstroAttributeNode[],
  attributeName: string,
): AstroAttributeNode | undefined =>
  attributes.find((attributeNode) => attributeNode.name === attributeName)

export const getAstroAttributeValue = (
  attributes: readonly AstroAttributeNode[],
  attributeName: string,
): string | undefined => {
  const attributeNode = getAstroAttribute(attributes, attributeName)

  return typeof attributeNode?.value === 'string' ? attributeNode.value : undefined
}
