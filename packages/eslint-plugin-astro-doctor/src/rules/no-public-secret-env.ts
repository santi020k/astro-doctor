import type { Rule } from 'eslint'

import { RULE_DOCS_BASE_URL } from '../constants.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const PUBLIC_ENV_PREFIX = 'PUBLIC_'
const SECRET_ENV_NAME_PARTS = new Set(['TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE', 'KEY'])
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const getPropertyName = (node: unknown, computed: boolean): string | undefined => {
  if (!isRecord(node)) return undefined

  if (!computed && node.type === 'Identifier' && typeof node.name === 'string') return node.name

  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined
}

const isImportMetaEnv = (node: unknown): boolean => {
  if (!isRecord(node) || node.type !== 'MemberExpression') return false

  if (getPropertyName(node.property, node.computed === true) !== 'env') return false

  const metaProperty = node.object

  return isRecord(metaProperty) && metaProperty.type === 'MetaProperty' &&
    getPropertyName(metaProperty.meta, false) === 'import' &&
    getPropertyName(metaProperty.property, false) === 'meta'
}

const looksLikeSecret = (variableName: string): boolean => variableName.startsWith(PUBLIC_ENV_PREFIX) &&
  variableName.split('_').some(namePart => SECRET_ENV_NAME_PARTS.has(namePart))

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Warn when PUBLIC_ environment variables appear to contain secrets',
      category: 'security',
      recommended: true,
      url: `${RULE_DOCS_BASE_URL}/no-public-secret-env`
    },
    messages: {
      publicSecretEnv:
        '{{variableName}} is exposed to client-side code because it starts with PUBLIC_. ' +
        'Rename it or move the secret to a server-only environment variable.'
    },
    schema: []
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    const reportSecret = (node: Rule.Node, variableName: string | undefined): void => {
      if (variableName === undefined || !looksLikeSecret(variableName)) return

      context.report({ node, messageId: 'publicSecretEnv', data: { variableName } })
    }

    return {
      MemberExpression(node) {
        if (!isImportMetaEnv(node.object)) return

        reportSecret(node, getPropertyName(node.property, node.computed))
      },
      VariableDeclarator(node) {
        if (!isImportMetaEnv(node.init) || node.id.type !== 'ObjectPattern') return

        for (const propertyNode of node.id.properties) {
          if (propertyNode.type !== 'Property') continue

          reportSecret(node, getPropertyName(propertyNode.key, propertyNode.computed))
        }
      }
    }
  }
})
