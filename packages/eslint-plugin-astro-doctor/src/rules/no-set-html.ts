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
      [`VAttribute[key.name="${SET_HTML_ATTRIBUTE_NAME}"]`](node: unknown) {
        context.report({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node: node as any,
          messageId: 'dangerousHtml',
        })
      },
    }
  },
})
