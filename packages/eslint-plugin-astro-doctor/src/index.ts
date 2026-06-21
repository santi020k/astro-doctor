import * as astroParser from 'astro-eslint-parser'
import type { Linter } from 'eslint'

import { RECOMMENDED_RULES, rules } from './rules/index.js'

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
    version: '0.1.0',
  },
  rules,
  configs: {},
}

plugin.configs.recommended = {
  files: ['**/*.astro'],
  plugins: {
    'astro-doctor': plugin,
  },
  languageOptions: {
    parser: astroParser,
    parserOptions: {
      sourceType: 'module',
    },
  },
  rules: RECOMMENDED_RULES,
}

export default plugin
export { RECOMMENDED_RULES, rules }
export type { AstroDoctorRule, RuleCategory } from './types.js'
