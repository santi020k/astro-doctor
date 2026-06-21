import type { Linter } from 'eslint'

import { RECOMMENDED_RULES,rules } from './rules/index.js'

const plugin = {
  meta: {
    name: '@santi020k/eslint-plugin-astro-doctor',
    version: '0.1.0',
  },
  rules,
  configs: {} as Record<string, Linter.Config>,
}

plugin.configs.recommended = {
  plugins: {
    'astro-doctor': plugin,
  },
  rules: RECOMMENDED_RULES,
}

export default plugin
export { RECOMMENDED_RULES,rules }
export type { AstroDoctorRule,RuleCategory } from './types.js'
