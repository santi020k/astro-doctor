import type { Rule } from 'eslint'

import { createRule, isAstroFile } from '../utils/rule.js'

const PUBLIC_ENV_PREFIX = 'PUBLIC_'
const SECRET_ENV_NAME_PARTS = ['TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE', 'KEY']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getIdentifierName = (node: unknown): string | undefined => {
  if (!isRecord(node) || node.type !== 'Identifier') return undefined

  return typeof node.name === 'string' ? node.name : undefined
}

const getPublicEnvName = (node: unknown): string | undefined => {
  if (!isRecord(node) || node.type !== 'MemberExpression') return undefined

  if (node.computed === true) return undefined

  const variableName = getIdentifierName(node.property)

  return variableName?.startsWith(PUBLIC_ENV_PREFIX) ? variableName : undefined
}

const looksLikeSecret = (variableName: string): boolean =>
  SECRET_ENV_NAME_PARTS.some((secretNamePart) => variableName.includes(secretNamePart))

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Warn when PUBLIC_ environment variables appear to contain secrets',
      category: 'security',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/no-public-secret-env.md',
    },
    messages: {
      publicSecretEnv:
        '{{variableName}} is exposed to client-side code because it starts with PUBLIC_. ' +
        'Rename it or move the secret to a server-only environment variable.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      'MemberExpression[object.type="MemberExpression"][object.object.type="MetaProperty"][object.property.name="env"]'(
        node: Rule.Node,
      ) {
        const variableName = getPublicEnvName(node)

        if (variableName === undefined || !looksLikeSecret(variableName)) return

        context.report({
          node,
          messageId: 'publicSecretEnv',
          data: { variableName },
        })
      },
    }
  },
})
