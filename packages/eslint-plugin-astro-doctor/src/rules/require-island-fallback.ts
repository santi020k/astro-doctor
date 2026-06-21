import type { AstroElementNode } from '../utils/astro-ast.js'
import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { getAstroAttributeValue, hasAstroAttribute } from '../utils/attribute.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const CLIENT_ONLY_ATTRIBUTE_NAME = 'client:only'
const SERVER_DEFER_ATTRIBUTE_NAME = 'server:defer'
const SLOT_ATTRIBUTE_NAME = 'slot'
const FALLBACK_SLOT_VALUE = 'fallback'

interface AstroElementRecord {
  readonly type?: string
  readonly attributes?: readonly unknown[]
  readonly children?: readonly unknown[]
}

const isAstroElementRecord = (node: unknown): node is AstroElementRecord =>
  typeof node === 'object' && node !== null

const isFallbackElement = (node: unknown): boolean => {
  if (!isAstroElementRecord(node)) return false

  return getAstroAttributeValue(node.attributes ?? [], SLOT_ATTRIBUTE_NAME) === FALLBACK_SLOT_VALUE
}

const hasFallbackSlot = (elementNode: AstroElementNode): boolean =>
  (elementNode.children ?? []).some((childNode) => isFallbackElement(childNode))

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require fallback content for client-only and deferred server islands',
      category: 'accessibility',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/require-island-fallback.md',
    },
    messages: {
      clientOnlyFallback:
        'client:only skips server rendering. Add an element with slot="fallback" so users are not left with empty UI while the island loads.',
      serverDeferFallback:
        'server:defer renders later on demand. Add an element with slot="fallback" to preserve useful initial UI.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroElement(context, (elementNode) => {
          if (hasFallbackSlot(elementNode)) return

          const attributes = elementNode.attributes ?? []

          if (hasAstroAttribute(attributes, CLIENT_ONLY_ATTRIBUTE_NAME)) {
            reportAstroNode(context, elementNode, 'clientOnlyFallback')

            return
          }

          if (!hasAstroAttribute(attributes, SERVER_DEFER_ATTRIBUTE_NAME)) return

          reportAstroNode(context, elementNode, 'serverDeferFallback')
        })
      },
    }
  },
})
