import type { Linter, Rule } from 'eslint'

import noBlockingScript from './no-blocking-script.js'
import noClientLoadOveruse from './no-client-load-overuse.js'
import noMissingAlt from './no-missing-alt.js'
import noMissingLang from './no-missing-lang.js'
import noProcessEnv from './no-process-env.js'
import noSetHtml from './no-set-html.js'
import preferClassList from './prefer-class-list.js'
import preferContentCollections from './prefer-content-collections.js'
import useAstroImage from './use-astro-image.js'

export const rules: Record<string, Rule.RuleModule> = {
  'no-blocking-script': noBlockingScript,
  'no-client-load-overuse': noClientLoadOveruse,
  'no-missing-alt': noMissingAlt,
  'no-missing-lang': noMissingLang,
  'no-process-env': noProcessEnv,
  'no-set-html': noSetHtml,
  'prefer-class-list': preferClassList,
  'prefer-content-collections': preferContentCollections,
  'use-astro-image': useAstroImage,
}

export const RECOMMENDED_RULES: Linter.RulesRecord = {
  'astro-doctor/no-blocking-script': 'warn',
  'astro-doctor/no-client-load-overuse': 'warn',
  'astro-doctor/no-missing-alt': 'error',
  'astro-doctor/no-missing-lang': 'error',
  'astro-doctor/no-process-env': 'warn',
  'astro-doctor/no-set-html': 'warn',
  'astro-doctor/prefer-class-list': 'warn',
  'astro-doctor/prefer-content-collections': 'warn',
  'astro-doctor/use-astro-image': 'warn',
}
