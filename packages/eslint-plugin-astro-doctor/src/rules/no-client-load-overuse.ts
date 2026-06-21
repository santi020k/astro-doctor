import { forEachAstroAttribute, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const CLIENT_LOAD_ATTRIBUTE_NAME = 'client:load'

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow overuse of client:load — prefer client:idle or client:visible for non-critical components',
      category: 'performance',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/no-client-load-overuse.md',
    },
    messages: {
      preferLazyDirective:
        'Avoid client:load for non-critical components. Prefer client:idle (after page load) or client:visible (on viewport entry) to reduce Time to Interactive.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroAttribute(context, (attributeNode) => {
          if (attributeNode.name !== CLIENT_LOAD_ATTRIBUTE_NAME) return

          reportAstroNode(context, attributeNode, 'preferLazyDirective')
        })
      },
    }
  },
})
