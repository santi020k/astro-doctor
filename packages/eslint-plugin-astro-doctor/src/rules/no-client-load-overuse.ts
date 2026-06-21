import { createRule, isAstroFile } from '../utils/rule.js'

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
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      // astro-eslint-parser exposes template attribute nodes via the HTML AST.
      // Client directives like client:load appear as VAttribute nodes where
      // the key name equals the directive string (e.g. "client:load").
      'VAttribute[key.name="client:load"]'(node: unknown) {
        context.report({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          node: node as any,
          messageId: 'preferLazyDirective',
        })
      },
    }
  },
})
