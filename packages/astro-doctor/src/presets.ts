import astroDoctorPlugin, {
  disableDuplicateAstroDoctorRules,
  getAstroEcosystemRules,
} from '@santi020k/eslint-plugin-astro-doctor'

import { CI_THRESHOLD_SCORE, DISABLED_THRESHOLD_SCORE } from './constants.js'
import { PROJECT_RULES } from './project-rules.js'

export type PresetName = 'recommended' | 'strict' | 'ci' | 'all'
export type RuleSeverity = 'error' | 'warn' | 'off'

const PRESET_NAMES = new Set(['recommended', 'strict', 'ci', 'all'])

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
    PROJECT_RULES
      .filter((projectRule) => projectRule.recommended)
      .map((projectRule) => [
        projectRule.ruleId,
        projectRule.severity === 'error' ? 'error' : 'warn',
      ]),
  )

const getStrictProjectRules = (): Record<string, RuleSeverity> =>
  Object.fromEntries(
    PROJECT_RULES
      .filter((projectRule) => projectRule.strict)
      .map((projectRule) => [projectRule.ruleId, 'error']),
  )

const getRecommendedRules = (): Record<string, RuleSeverity> => ({
  ...getRecommendedPluginRules(),
  ...getRecommendedProjectRules(),
})

export const isPresetName = (value: unknown): value is PresetName =>
  typeof value === 'string' && PRESET_NAMES.has(value)

export const getPresetRules = (preset: PresetName): Record<string, RuleSeverity> => {
  const recommendedRules = getRecommendedRules()
  const ecosystemRules = getAstroEcosystemRules(preset)

  const strictProjectRules = preset === 'strict' || preset === 'all'
    ? getStrictProjectRules()
    : {}

  const combinedRules = {
    ...recommendedRules,
    ...ecosystemRules,
    ...strictProjectRules,
  }

  const presetRules: Record<string, RuleSeverity> = preset === 'strict' || preset === 'all'
    ? Object.fromEntries(
        Object.entries(combinedRules).map(([ruleId, severity]) => [
          ruleId,
          severity === 'off' ? 'off' : 'error',
        ] satisfies [string, RuleSeverity]),
      )
    : combinedRules

  return disableDuplicateAstroDoctorRules(presetRules)
}

export const getPresetFailOn = (preset: PresetName): 'error' | 'warning' =>
  preset === 'ci' ? 'warning' : 'error'

export const getPresetThreshold = (preset: PresetName): number =>
  preset === 'ci' ? CI_THRESHOLD_SCORE : DISABLED_THRESHOLD_SCORE
