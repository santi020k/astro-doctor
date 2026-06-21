import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const HTML_ELEMENT_NAME = 'html'
const LANGUAGE_ATTRIBUTE_NAME = 'lang'

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a lang attribute on the <html> element',
      category: 'accessibility',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/no-missing-lang.md',
    },
    messages: {
      missingLang:
        '<html> is missing a lang attribute. Screen readers and search engines use lang to ' +
        'determine the page language. Add lang="en" (or the appropriate BCP 47 language tag).',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroElement(context, (elementNode) => {
          if (elementNode.name !== HTML_ELEMENT_NAME) return

          const hasLanguage = (elementNode.attributes ?? []).some(
            (attributeNode) => attributeNode.name === LANGUAGE_ATTRIBUTE_NAME,
          )

          if (!hasLanguage) {
            reportAstroNode(context, elementNode, 'missingLang')
          }
        })
      },
    }
  },
})
