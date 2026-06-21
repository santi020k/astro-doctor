import type { Linter } from 'eslint'
import { rules, RECOMMENDED_RULES } from './rules/index.js'

const plugin = {
  meta: {
    name: '@santi020k/eslint-plugin-astro-doctor',
    version: '0.1.0',
  },
  rules,
  configs: {} as Record<string, Linter.Config>,
}

plugin.configs['recommended'] = {
  plugins: {
    'astro-doctor': plugin,
  },
  rules: RECOMMENDED_RULES,
}

export default plugin
export { rules, RECOMMENDED_RULES }
export type { RuleCategory, AstroDoctorRule } from './types.js'
