import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const IMAGE_ELEMENT_NAME = 'img'

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce the use of <Image> or <Picture> from astro:assets instead of raw <img> elements',
      category: 'performance',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/use-astro-image.md',
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

          reportAstroNode(context, elementNode, 'useAstroImage')
        })
      },
    }
  },
})
