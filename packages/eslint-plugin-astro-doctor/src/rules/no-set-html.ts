import { forEachAstroAttribute, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const SET_HTML_ATTRIBUTE_NAME = 'set:html'

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Warn against the use of set:html to prevent potential XSS vulnerabilities',
      category: 'security',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/no-set-html.md',
    },
    messages: {
      dangerousHtml:
        'set:html injects raw HTML and is a potential XSS vector if the value is user-controlled. ' +
        'Use {expression} interpolation for escaped output, or sanitize the value before using set:html.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroAttribute(context, (attributeNode) => {
          if (attributeNode.name !== SET_HTML_ATTRIBUTE_NAME) return

          reportAstroNode(context, attributeNode, 'dangerousHtml')
        })
      },
    }
  },
})
