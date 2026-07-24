import type { RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'

import type { Severity } from './types.js'

export interface ProjectRuleMeta {
  readonly ruleId: string
  readonly severity: Severity
  readonly category: RuleCategory
  readonly recommended: boolean
}

export const PROJECT_RULES: readonly ProjectRuleMeta[] = [
  {
    ruleId: 'astro-doctor/no-disabled-origin-check',
    severity: 'warning',
    category: 'security',
    recommended: true,
  },
  {
    ruleId: 'astro-doctor/no-open-allowed-domains',
    severity: 'warning',
    category: 'security',
    recommended: true,
  },
  {
    ruleId: 'astro-doctor/no-public-secret-env',
    severity: 'warning',
    category: 'security',
    recommended: true,
  },
  {
    ruleId: 'astro-doctor/prefer-env-schema',
    severity: 'warning',
    category: 'best-practices',
    recommended: true,
  },
  {
    ruleId: 'astro-doctor/prefer-pnpm',
    severity: 'warning',
    category: 'best-practices',
    recommended: false,
  },
  {
    ruleId: 'astro-doctor/require-content-config',
    severity: 'warning',
    category: 'best-practices',
    recommended: true,
  },
]

export const getProjectRuleMeta = (ruleId: string): ProjectRuleMeta | undefined =>
  PROJECT_RULES.find((projectRule) => projectRule.ruleId === ruleId)
