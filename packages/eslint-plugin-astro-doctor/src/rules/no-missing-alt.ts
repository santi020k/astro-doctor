import type { Rule } from 'eslint'

import type { AstroNode } from '../types.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const IMAGE_ELEMENT_NAMES = new Set(['img', 'Image', 'Picture'])

const hasAltAttribute = (attributes: unknown[]): boolean =>
  attributes.some(
    (attribute) =>
       
      (attribute as AstroNode).type === 'VAttribute' && (attribute as AstroNode).key?.name === 'alt'
  )

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
    schema: [], // no options
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      VElement(node: unknown) {
         
        const elementNode = node as AstroNode
        const elementName: string = elementNode.rawName ?? elementNode.name ?? ''

        if (!IMAGE_ELEMENT_NAMES.has(elementName)) return

         
        const attributes: unknown[] = elementNode.startTag?.attributes ?? []

        if (!hasAltAttribute(attributes)) {
          context.report({
            node: elementNode as Rule.Node,
            messageId: 'missingAlt',
          })
        }
      },
    }
  },
})
