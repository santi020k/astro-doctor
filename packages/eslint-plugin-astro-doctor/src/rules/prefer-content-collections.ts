import type { Rule } from 'eslint'

import { createRule, isAstroFile } from '../utils/rule.js'

const CONTENT_GLOB_INDICATORS = ['.md', '.mdx', '.mdoc', '{md', ',md', '{mdx', ',mdx']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getLiteralValue = (node: unknown): string | undefined => {
  if (!isRecord(node) || node.type !== 'Literal') return undefined

  return typeof node.value === 'string' ? node.value : undefined
}

const isContentGlobPattern = (globPattern: string): boolean =>
  CONTENT_GLOB_INDICATORS.some((indicator) => globPattern.includes(indicator))

const getFirstArgumentValue = (node: unknown): string | undefined => {
  if (!isRecord(node) || node.type !== 'CallExpression') return undefined

  const callArguments = Array.isArray(node.arguments) ? node.arguments : []

  return getLiteralValue(callArguments[0])
}

const isContentGlobCall = (node: Rule.Node): boolean => {
  const globPattern = getFirstArgumentValue(node)

  return globPattern !== undefined && isContentGlobPattern(globPattern)
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
