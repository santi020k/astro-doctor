import { createRule, isAstroFile } from '../utils/rule.js'

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
      // In astro-eslint-parser, raw HTML elements in the template are VElement nodes.
      // The rawName property holds the original tag name from source.
      'VElement[rawName="img"]'(node: unknown) {
        context.report({
          node: node as never,
          messageId: 'useAstroImage',
        })
      },
    }
  },
})
