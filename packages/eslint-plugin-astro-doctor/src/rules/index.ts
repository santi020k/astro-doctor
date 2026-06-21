import type { Rule } from 'eslint'
import noClientLoadOveruse from './no-client-load-overuse.js'
import noMissingAlt from './no-missing-alt.js'
import noSetHtml from './no-set-html.js'
import preferClassList from './prefer-class-list.js'
import useAstroImage from './use-astro-image.js'

export const rules: Record<string, Rule.RuleModule> = {
  'no-client-load-overuse': noClientLoadOveruse,
  'no-missing-alt': noMissingAlt,
  'no-set-html': noSetHtml,
  'prefer-class-list': preferClassList,
  'use-astro-image': useAstroImage,
}

export const RECOMMENDED_RULES: Record<string, string> = {
  'astro-doctor/no-client-load-overuse': 'warn',
  'astro-doctor/no-missing-alt': 'error',
  'astro-doctor/no-set-html': 'warn',
  'astro-doctor/prefer-class-list': 'warn',
  'astro-doctor/use-astro-image': 'warn',
}
