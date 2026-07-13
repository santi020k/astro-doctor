import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { getAstroAttributeValue, hasAstroAttribute } from '../utils/attribute.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const SCRIPT_ELEMENT_NAME = 'script'
const SOURCE_ATTRIBUTE_NAME = 'src'
const INLINE_DIRECTIVE_NAME = 'is:inline'
const TYPE_ATTRIBUTE_NAME = 'type'
const JSON_LD_TYPE = 'application/ld+json'

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn when script attributes opt out of Astro script processing, bundling, and deduplication',
      category: 'performance',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/no-unprocessed-script-surprises.md',
    },
    messages: {
      unprocessedScript:
        '<script> tags with attributes other than src are not processed by Astro. Move attributes to the loaded script only when this opt-out is intentional.',
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

          if (hasAstroAttribute(attributes, INLINE_DIRECTIVE_NAME)) return

          if (getAstroAttributeValue(attributes, TYPE_ATTRIBUTE_NAME) === JSON_LD_TYPE) return

          const hasProcessingOptOutAttribute = attributes.some(
            (attributeNode) => attributeNode.name !== SOURCE_ATTRIBUTE_NAME,
          )

          if (!hasProcessingOptOutAttribute) return

          reportAstroNode(context, elementNode, 'unprocessedScript')
        })
      },
    }
  },
})
