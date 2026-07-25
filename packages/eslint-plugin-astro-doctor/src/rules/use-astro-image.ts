import { RULE_DOCS_BASE_URL } from '../constants.js'
import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { hasAstroAttribute } from '../utils/attribute.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const IMAGE_ELEMENT_NAME = 'img'
const SOURCE_ATTRIBUTE_NAME = 'src'

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce the use of <Image> or <Picture> from astro:assets instead of raw <img> elements',
      category: 'performance',
      recommended: true,
      url: `${RULE_DOCS_BASE_URL}/use-astro-image`,
    },
    messages: {
      useAstroImage:
        'Use <Image> or <Picture> from astro:assets instead of <img>. ' +
        'Astro\'s image components enforce alt text, run build-time optimization, and output modern formats.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroElement(context, (elementNode) => {
          if (elementNode.name !== IMAGE_ELEMENT_NAME) return

          if (!hasAstroAttribute(elementNode.attributes ?? [], SOURCE_ATTRIBUTE_NAME)) return

          reportAstroNode(context, elementNode, 'useAstroImage')
        })
      },
    }
  },
})
