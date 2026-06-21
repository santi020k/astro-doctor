import { createRule, isAstroFile } from '../utils/rule.js'

const isDynamicClassExpression = (attributeValue: unknown): boolean => {
   
  const value = attributeValue as any

  if (!value) return false

  // Template literal with expressions — e.g. `btn ${isActive ? 'active' : ''}`
  if (value.type === 'VExpressionContainer') {
    const expression = value.expression

    if (!expression) return false

    // TemplateLiteral with at least one expression (not purely static)
    if (expression.type === 'TemplateLiteral' && expression.expressions.length > 0) {
      return true
    }

    // BinaryExpression used for string concatenation — e.g. "btn " + conditional
    if (expression.type === 'BinaryExpression' && expression.operator === '+') {
      return true
    }
  }

  return false
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
      'VAttribute[key.name="class"]'(node: unknown) {
         
        const attributeNode = node as any

        if (isDynamicClassExpression(attributeNode.value)) {
          context.report({
            node: attributeNode,
            messageId: 'preferClassList',
          })
        }
      },
    }
  },
})
