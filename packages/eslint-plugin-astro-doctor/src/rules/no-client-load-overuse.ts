import type { AstroAttributeNode } from '../utils/astro-ast.js'
import { forEachAstroAttribute, reportAstroNode } from '../utils/astro-ast.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const CLIENT_LOAD_ATTRIBUTE_NAME = 'client:load'
const DEFAULT_MAX = 1

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
      tooManyClientLoad:
        'This file uses client:load {{count}} times (max: {{max}}). Move non-critical components to client:idle or client:visible to reduce Time to Interactive.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            minimum: 0,
            description: 'Maximum number of client:load usages allowed per file (default: 1).',
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    const options = context.options[0] as { max?: number } | undefined
    const max = options?.max ?? DEFAULT_MAX
    const collected: AstroAttributeNode[] = []

    return {
      Program() {
        forEachAstroAttribute(context, (attributeNode) => {
          if (attributeNode.name === CLIENT_LOAD_ATTRIBUTE_NAME) {
            collected.push(attributeNode)
          }
        })
      },
      'Program:exit'() {
        if (collected.length <= max) return

        if (max === 0) {
          // Report each occurrence individually
          for (const attributeNode of collected) {
            reportAstroNode(context, attributeNode, 'preferLazyDirective')
          }
        } else {
          // Report once at the file level on the first excess usage
          const firstExcess = collected[max]

          if (firstExcess) {
            context.report({
              loc: { line: firstExcess.position?.start?.line ?? 1, column: Math.max(0, (firstExcess.position?.start?.column ?? 1) - 1) },
              messageId: 'tooManyClientLoad',
              data: { count: String(collected.length), max: String(max) },
            })
          }
        }
      },
    }
  },
})
