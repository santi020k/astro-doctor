import type { Rule } from 'eslint'

import { createRule, isAstroFile } from '../utils/rule.js'

export default createRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow process.env in Astro files — use import.meta.env instead',
      category: 'best-practices',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/no-process-env.md',
    },
    messages: {
      useImportMetaEnv:
        'Use import.meta.env instead of process.env in Astro files. ' +
        'import.meta.env works in both server and client contexts and supports ' +
        'Astro\'s PUBLIC_ variable visibility rules.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      'MemberExpression[object.name="process"][property.name="env"]'(node: Rule.Node) {
        context.report({
          node,
          messageId: 'useImportMetaEnv',
        })
      },
    }
  },
})
