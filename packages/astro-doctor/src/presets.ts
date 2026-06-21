import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

import { CI_THRESHOLD_SCORE, DISABLED_THRESHOLD_SCORE } from './constants.js'
import { PROJECT_RULES } from './project-rules.js'

export type PresetName = 'recommended' | 'strict' | 'ci'
export type RuleSeverity = 'error' | 'warn' | 'off'

const PRESET_NAMES = new Set(['recommended', 'strict', 'ci'])

const normalizeRuleSeverity = (severity: unknown): RuleSeverity | undefined => {
  if (severity === 'error' || severity === 'warn' || severity === 'off') return severity

  return undefined
}

const getRecommendedPluginRules = (): Record<string, RuleSeverity> => {
  const recommendedRules = astroDoctorPlugin.configs.recommended?.rules ?? {}
  const normalizedRules: Record<string, RuleSeverity> = {}

  for (const [ruleId, ruleValue] of Object.entries(recommendedRules)) {
    const severity = Array.isArray(ruleValue) ? ruleValue[0] : ruleValue
    const normalizedSeverity = normalizeRuleSeverity(severity)

    if (normalizedSeverity === undefined) continue

    normalizedRules[ruleId] = normalizedSeverity
  }

  return normalizedRules
}

const getRecommendedProjectRules = (): Record<string, RuleSeverity> =>
  Object.fromEntries(
    PROJECT_RULES.map((projectRule) => [
      projectRule.ruleId,
      projectRule.severity === 'error' ? 'error' : 'warn',
    ]),
  )

const getRecommendedRules = (): Record<string, RuleSeverity> => ({
  ...getRecommendedPluginRules(),
  ...getRecommendedProjectRules(),
})

export const isPresetName = (value: unknown): value is PresetName =>
  typeof value === 'string' && PRESET_NAMES.has(value)

export const getPresetRules = (preset: PresetName): Record<string, RuleSeverity> => {
  const recommendedRules = getRecommendedRules()

  if (preset !== 'strict') return recommendedRules

  return Object.fromEntries(
    Object.keys(recommendedRules).map((ruleId) => [ruleId, 'error']),
  )
}

export const getPresetFailOn = (preset: PresetName): 'error' | 'warning' =>
  preset === 'ci' ? 'warning' : 'error'

export const getPresetThreshold = (preset: PresetName): number =>
  preset === 'ci' ? CI_THRESHOLD_SCORE : DISABLED_THRESHOLD_SCORE
