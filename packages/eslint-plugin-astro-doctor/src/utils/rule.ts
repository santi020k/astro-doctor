import type { Rule } from 'eslint'

import type { AstroDoctorRule } from '../types.js'

export const createRule = (rule: AstroDoctorRule): Rule.RuleModule => rule

export const isAstroFile = (filename: string): boolean =>
  filename.endsWith('.astro')
