import type { Linter } from 'eslint'
import astroPlugin from 'eslint-plugin-astro'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'

import type { RuleCategory } from './types.js'

export type AstroRulePreset = 'recommended' | 'strict' | 'ci' | 'all'
export type RuleSeverity = 'error' | 'warn' | 'off'

const LEGACY_DEPRECATED_ASTRO_RULE_IDS = new Set([
  'astro/valid-compile',
])

const STRICT_ASTRO_RULE_IDS = [
  'astro/no-exports-from-components',
  'astro/no-prerender-export-outside-pages',
  'astro/no-set-html-directive',
  'astro/no-set-text-directive',
  'astro/no-unsafe-inline-scripts',
  'astro/no-unused-css-selector',
]

const SECURITY_ASTRO_RULE_IDS = new Set([
  'astro/no-set-html-directive',
  'astro/no-unsafe-inline-scripts',
])

const ASTRO_DOCTOR_DUPLICATE_RULES: Record<string, string> = {
  'astro/jsx-a11y/alt-text': 'astro-doctor/no-missing-alt',
  'astro/jsx-a11y/html-has-lang': 'astro-doctor/no-missing-lang',
  'astro/no-set-html-directive': 'astro-doctor/no-set-html',
  'astro/prefer-class-list-directive': 'astro-doctor/prefer-class-list',
}

const ASTRO_JSX_A11Y_RULES = Object.fromEntries(
  Object.entries(jsxA11yPlugin.rules ?? {}).map(([ruleName, rule]) => [
    `jsx-a11y/${ruleName}`,
    rule,
  ]),
)

const isDeprecatedAstroRuleId = (ruleId: string): boolean => {
  if (!ruleId.startsWith('astro/')) return false

  if (LEGACY_DEPRECATED_ASTRO_RULE_IDS.has(ruleId)) return true

  const ruleName = ruleId.slice('astro/'.length)

  return Boolean(astroPlugin.rules[ruleName]?.meta?.deprecated)
}

const normalizeRuleSeverity = (
  ruleEntry: Linter.RuleEntry | undefined,
): RuleSeverity | undefined => {
  if (ruleEntry === undefined) return undefined

  const severity = Array.isArray(ruleEntry) ? ruleEntry[0] : ruleEntry

  if (severity === 'error' || severity === 2) return 'error'

  if (severity === 'warn' || severity === 1) return 'warn'

  return 'off'
}

const getFlatConfigRules = (
  configName: 'flat/recommended' | 'flat/jsx-a11y-recommended',
): Record<string, RuleSeverity> => {
  const normalizedRules: Record<string, RuleSeverity> = {}

  for (const config of astroPlugin.configs[configName]) {
    for (const [ruleId, ruleEntry] of Object.entries(config.rules ?? {})) {
      if (!ruleId.startsWith('astro/') || isDeprecatedAstroRuleId(ruleId)) continue

      const severity = normalizeRuleSeverity(ruleEntry)

      if (severity !== undefined && severity !== 'off') normalizedRules[ruleId] = severity
    }
  }

  return normalizedRules
}

const getRecommendedRules = (): Record<string, RuleSeverity> =>
  getFlatConfigRules('flat/recommended')

const getJsxA11yRecommendedRules = (): Record<string, RuleSeverity> =>
  Object.fromEntries(
    Object.entries(jsxA11yPlugin.flatConfigs.recommended.rules ?? {})
      .map(([ruleId, ruleEntry]) => [
        `astro/${ruleId}`,
        normalizeRuleSeverity(ruleEntry),
      ])
      .filter((ruleEntry): ruleEntry is [string, RuleSeverity] => ruleEntry[1] !== undefined),
  )

const getStrictRules = (): Record<string, RuleSeverity> => ({
  ...getRecommendedRules(),
  ...getJsxA11yRecommendedRules(),
  ...Object.fromEntries(STRICT_ASTRO_RULE_IDS.map((ruleId) => [ruleId, 'error'])),
})

const getAllRules = (): Record<string, RuleSeverity> =>
  Object.fromEntries(
    Object.keys(astroPlugin.rules)
      .map((ruleName) => `astro/${ruleName}`)
      .filter((ruleId) => !isDeprecatedAstroRuleId(ruleId))
      .map((ruleId) => [ruleId, 'error']),
  )

export const getAstroEcosystemRules = (
  preset: AstroRulePreset,
): Record<string, RuleSeverity> => {
  if (preset === 'all') return getAllRules()

  if (preset === 'strict') return getStrictRules()

  return getRecommendedRules()
}

export const disableDuplicateAstroDoctorRules = (
  rules: Record<string, RuleSeverity>,
): Record<string, RuleSeverity> => {
  const deduplicatedRules = { ...rules }

  for (const [upstreamRuleId, astroDoctorRuleId] of Object.entries(ASTRO_DOCTOR_DUPLICATE_RULES)) {
    const upstreamSeverity = deduplicatedRules[upstreamRuleId]

    if (upstreamSeverity !== undefined && upstreamSeverity !== 'off') {
      deduplicatedRules[astroDoctorRuleId] = 'off'
    }
  }

  return deduplicatedRules
}

export const ASTRO_ESLINT_PLUGINS: NonNullable<Linter.Config['plugins']> = {
  astro: {
    ...astroPlugin,
    rules: {
      ...astroPlugin.rules,
      ...ASTRO_JSX_A11Y_RULES,
    },
  },
}

export const getAstroRuleCategory = (ruleId: string): RuleCategory | undefined => {
  if (!ruleId.startsWith('astro/')) return undefined

  if (ruleId.startsWith('astro/jsx-a11y/')) return 'accessibility'

  if (SECURITY_ASTRO_RULE_IDS.has(ruleId)) return 'security'

  return 'best-practices'
}

export const getAstroRuleDocUrl = (ruleId: string): string | undefined => {
  if (!ruleId.startsWith('astro/')) return undefined

  const ruleName = ruleId.slice('astro/'.length)

  return astroPlugin.rules[ruleName]?.meta?.docs?.url
}

export const getAstroRuleDescription = (ruleId: string): string | undefined => {
  if (!ruleId.startsWith('astro/')) return undefined

  const ruleName = ruleId.slice('astro/'.length)

  return astroPlugin.rules[ruleName]?.meta?.docs?.description
}

export const getAstroEcosystemRuleDocs = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(astroPlugin.rules)
      .filter(([ruleName]) => !isDeprecatedAstroRuleId(`astro/${ruleName}`))
      .map(([ruleName, rule]) => {
        const ruleId = `astro/${ruleName}`
        const category = getAstroRuleCategory(ruleId)?.replace('-', ' ') ?? 'best practices'
        const description = rule.meta?.docs?.description ?? ruleName

        return [ruleId, `${category} · ${description}`]
      }),
  )

export const getAstroEcosystemRuleCount = (): number => Object.keys(getAllRules()).length
