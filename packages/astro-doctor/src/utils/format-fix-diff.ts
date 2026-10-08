import { formatPatch, structuredPatch } from 'diff'

import { FIX_DIFF_CONTEXT_LINES } from '../constants.js'

export const formatFixDiff = (filePath: string, original: string, fixed: string): string => {
  const patch = structuredPatch(
    `a/${filePath}`, `b/${filePath}`, original, fixed, undefined, undefined, { context: FIX_DIFF_CONTEXT_LINES }
  )

  return formatPatch({ ...patch, isGit: true })
}
