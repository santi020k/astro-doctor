import { RULE_DOCS_BASE_URL } from '../constants.js'
import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const SCRIPT_ELEMENT_NAME = 'script'
const SCRIPT_SOURCE_ATTRIBUTE_NAME = 'src'
const DEFER_ATTRIBUTE_NAME = 'defer'
const ASYNC_ATTRIBUTE_NAME = 'async'
const TYPE_ATTRIBUTE_NAME = 'type'
const MODULE_ATTRIBUTE_VALUE = 'module'

interface AstroAttributeLike {
  readonly name?: string
  readonly value?: unknown
}

const hasAttribute = (
  attributes: readonly AstroAttributeLike[],
  attributeName: string,
): boolean => attributes.some((attributeNode) => attributeNode.name === attributeName)

const getAttributeValue = (
  attributes: readonly AstroAttributeLike[],
  attributeName: string,
): string | undefined => {
  const attributeNode = attributes.find((innerAttributeNode) => innerAttributeNode.name === attributeName)

  return typeof attributeNode?.value === 'string' ? attributeNode.value : undefined
}

export default createRule({
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description:
        'Disallow render-blocking <script src="..."> tags — add defer, async, or type="module"',
      category: 'performance',
      recommended: true,
      url: `${RULE_DOCS_BASE_URL}/no-blocking-script`,
    },
    messages: {
      blockingScript:
        '<script src="..."> without defer, async, or type="module" blocks HTML parsing. ' +
        'Add defer (preserves execution order) or async (fires as soon as downloaded), ' +
        'or switch to type="module" which is always deferred.',
      addDefer: 'Add defer to preserve document execution order.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroElement(context, (elementNode) => {
          if (elementNode.name !== SCRIPT_ELEMENT_NAME) return

          const attributes = elementNode.attributes ?? []

          if (!hasAttribute(attributes, SCRIPT_SOURCE_ATTRIBUTE_NAME)) return

          const hasDefer = hasAttribute(attributes, DEFER_ATTRIBUTE_NAME)
          const hasAsync = hasAttribute(attributes, ASYNC_ATTRIBUTE_NAME)
          const isModule = getAttributeValue(attributes, TYPE_ATTRIBUTE_NAME) === MODULE_ATTRIBUTE_VALUE

          if (!hasDefer && !hasAsync && !isModule) {
            const startPosition = elementNode.position?.start

            reportAstroNode(
              context,
              elementNode,
              'blockingScript',
              startPosition
                ? [{
                    messageId: 'addDefer',
                    fix: (fixer) => {
                      const elementStartIndex = context.sourceCode.getIndexFromLoc({
                        line: startPosition.line,
                        column: Math.max(0, startPosition.column - 1),
                      })

                      const tagNameEndIndex = elementStartIndex + SCRIPT_ELEMENT_NAME.length + 1

                      return fixer.insertTextAfterRange(
                        [tagNameEndIndex - 1, tagNameEndIndex],
                        ' defer',
                      )
                    },
                  }]
                : undefined,
            )
          }
        })
      },
    }
  },
})
