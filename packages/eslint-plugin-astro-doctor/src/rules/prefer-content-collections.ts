import type { Rule } from 'eslint'

import { createRule, isAstroFile } from '../utils/rule.js'

interface CallExpressionNode extends Rule.Node {
  readonly arguments?: readonly Rule.Node[]
}

interface LiteralNode extends Rule.Node {
  readonly value?: unknown
}

const CONTENT_GLOB_INDICATORS = ['.md', '.mdx', '.mdoc', '{md', ',md', '{mdx', ',mdx']

const isCallExpressionNode = (node: Rule.Node): node is CallExpressionNode =>
  node.type === 'CallExpression'

const isLiteralNode = (node: Rule.Node | undefined): node is LiteralNode =>
  node?.type === 'Literal'

const isContentGlobPattern = (globPattern: string): boolean =>
  CONTENT_GLOB_INDICATORS.some((indicator) => globPattern.includes(indicator))

const isContentGlobCall = (node: Rule.Node): boolean => {
  if (!isCallExpressionNode(node)) return false

  const globPatternNode = node.arguments?.[0]

  if (!isLiteralNode(globPatternNode)) return false

  return typeof globPatternNode.value === 'string' && isContentGlobPattern(globPatternNode.value)
}

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer Content Collections over Astro.glob() for Markdown and MDX files',
      category: 'best-practices',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/prefer-content-collections.md',
    },
    messages: {
      preferContentCollections:
        'Avoid Astro.glob() for content files. Use getCollection() from "astro:content" instead — ' +
        'it provides TypeScript types, build-time validation, and better performance through caching.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      'CallExpression[callee.type="MemberExpression"][callee.object.name="Astro"][callee.property.name="glob"]'(
        node: Rule.Node,
      ) {
        context.report({
          node,
          messageId: 'preferContentCollections',
        })
      },
      'CallExpression[callee.type="MemberExpression"][callee.object.type="MetaProperty"][callee.property.name="glob"]'(
        node: Rule.Node,
      ) {
        if (!isContentGlobCall(node)) return

        context.report({
          node,
          messageId: 'preferContentCollections',
        })
      },
    }
  },
})
