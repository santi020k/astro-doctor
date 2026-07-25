import { createRequire } from 'node:module'

import * as astroParser from 'astro-eslint-parser'
import type { Linter } from 'eslint'

import { RECOMMENDED_RULES, rules } from './rules/index.js'
import {
  ASTRO_ESLINT_PLUGINS,
  disableDuplicateAstroDoctorRules,
  getAstroEcosystemRules,
} from './astro-rules.js'

const require = createRequire(import.meta.url)

interface PackageJson {
  readonly version: string
}

const { version } = require('../package.json') as PackageJson

interface AstroDoctorPlugin {
  readonly meta: {
    readonly name: string
    readonly version: string
  }
  readonly rules: typeof rules
  readonly configs: Record<string, Linter.Config>
}

const plugin: AstroDoctorPlugin = {
  meta: {
    name: '@santi020k/eslint-plugin-astro-doctor',
    version,
  },
  rules,
  configs: {},
}

plugin.configs.recommended = {
  files: ['**/*.astro'],
  plugins: {
    'astro-doctor': plugin,
    ...ASTRO_ESLINT_PLUGINS,
  },
  languageOptions: {
    parser: astroParser,
    parserOptions: {
      sourceType: 'module',
    },
  },
  rules: disableDuplicateAstroDoctorRules({
    ...RECOMMENDED_RULES,
    ...getAstroEcosystemRules('recommended'),
  }),
}

const getStrictAstroDoctorRules = (): Record<string, 'error'> =>
  Object.fromEntries(Object.keys(RECOMMENDED_RULES).map((ruleId) => [ruleId, 'error']))

plugin.configs.strict = {
  ...plugin.configs.recommended,
  rules: disableDuplicateAstroDoctorRules({
    ...getStrictAstroDoctorRules(),
    ...getAstroEcosystemRules('strict'),
  }),
}

plugin.configs.all = {
  ...plugin.configs.recommended,
  rules: disableDuplicateAstroDoctorRules({
    ...getStrictAstroDoctorRules(),
    ...getAstroEcosystemRules('all'),
  }),
}

export default plugin
export { RECOMMENDED_RULES, rules }
export type { AstroRulePreset, RuleSeverity } from './astro-rules.js'
export {
  ASTRO_ESLINT_PLUGINS,
  disableDuplicateAstroDoctorRules,
  getAstroEcosystemRuleCount,
  getAstroEcosystemRuleDocs,
  getAstroEcosystemRules,
  getAstroRuleCategory,
  getAstroRuleDescription,
  getAstroRuleDocUrl,
} from './astro-rules.js'
export type { AstroDoctorRule, RuleCategory } from './types.js'
