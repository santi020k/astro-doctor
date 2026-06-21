import type { AstroAttributeNode } from '../utils/astro-ast.js'
import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const IMAGE_ELEMENT_NAMES = new Set(['img', 'Image', 'Picture'])
const ALT_ATTRIBUTE_NAME = 'alt'

const hasAltAttribute = (attributes: readonly AstroAttributeNode[]): boolean =>
  attributes.some((attributeNode) => attributeNode.name === ALT_ATTRIBUTE_NAME)

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require alt attributes on image elements (<img>, <Image>, <Picture>)',
      category: 'accessibility',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/no-missing-alt.md',
    },
    messages: {
      missingAlt:
        'Image elements must have an alt attribute. Provide a descriptive text for meaningful images, or alt="" for decorative ones.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroElement(context, (elementNode) => {
          if (!elementNode.name || !IMAGE_ELEMENT_NAMES.has(elementNode.name)) return

          if (hasAltAttribute(elementNode.attributes ?? [])) return

          reportAstroNode(context, elementNode, 'missingAlt')
        })
      },
    }
  },
})
