import { forEachAstroAttribute, reportAstroNode } from '../utils/astro-ast.js'
import { getAstroAttributeValue } from '../utils/attribute.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const SET_HTML_ATTRIBUTE_NAME = 'set:html'
const SCRIPT_ELEMENT_NAME = 'script'
const TYPE_ATTRIBUTE_NAME = 'type'
const JSON_LD_TYPE = 'application/ld+json'

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
        forEachAstroAttribute(context, (attributeNode, elementNode) => {
          if (attributeNode.name !== SET_HTML_ATTRIBUTE_NAME) return

          const isJsonLdScript =
            elementNode.name === SCRIPT_ELEMENT_NAME &&
            getAstroAttributeValue(elementNode.attributes ?? [], TYPE_ATTRIBUTE_NAME) === JSON_LD_TYPE

          if (isJsonLdScript) return

          reportAstroNode(context, attributeNode, 'dangerousHtml')
        })
      },
    }
  },
})
