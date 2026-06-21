import type { AstroAttributeNode } from '../utils/astro-ast.js'
import { forEachAstroAttribute, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const CLASS_ATTRIBUTE_NAME = 'class'
const EXPRESSION_ATTRIBUTE_KIND = 'expression'

const isDynamicClassExpression = (attributeNode: AstroAttributeNode): boolean => {
  if (attributeNode.kind !== EXPRESSION_ATTRIBUTE_KIND) return false

  if (typeof attributeNode.value !== 'string') return false

  const expression = attributeNode.value.trim()

  if (expression.startsWith('`') && expression.includes('${')) return true

  return expression.includes('+')
}

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce class:list over template literals or string concatenation for dynamic class names',
      category: 'best-practices',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/prefer-class-list.md',
    },
    messages: {
      preferClassList:
        'Use class:list={[...]} instead of template literals or string concatenation for dynamic class names. ' +
        'class:list is more readable, supports objects for conditional classes, and is the Astro-idiomatic approach.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroAttribute(context, (attributeNode) => {
          if (attributeNode.name !== CLASS_ATTRIBUTE_NAME) return

          if (!isDynamicClassExpression(attributeNode)) return

          reportAstroNode(context, attributeNode, 'preferClassList')
        })
      },
    }
  },
})
