import type { Rule } from 'eslint'

import { RULE_DOCS_BASE_URL } from '../constants.js'
import { createRule, isAstroFile } from '../utils/rule.js'

export default createRule({
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Disallow process.env in Astro files — use import.meta.env instead',
      category: 'best-practices',
      recommended: true,
      url: `${RULE_DOCS_BASE_URL}/no-process-env`,
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
          fix: (fixer) => fixer.replaceText(node, 'import.meta.env'),
        })
      },
    }
  },
})
