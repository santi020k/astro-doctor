import { describe, expect, test } from 'vitest'

import { maskCodeComments, maskCodeLiterals } from '../../src/utils/mask-code-literals.js'

describe('maskCodeLiterals', () => {
  test('masks regex literals while preserving their positions', () => {
    const content = 'const pattern = /} export default [a-z]+/giu\nexport const value = 1'
    const maskedContent = maskCodeLiterals(content)

    expect(maskedContent).toHaveLength(content.length)
    expect(maskedContent).not.toContain('export default')
    expect(maskedContent).toContain('export const value')
  })

  test('does not mask division expressions', () => {
    const content = 'const ratio = total / count / scale'

    expect(maskCodeLiterals(content)).toBe(content)
  })

  test('masks comments without masking quoted keys', () => {
    const content = '{ "fetchFile" /* disabled */: null }'
    const maskedContent = maskCodeComments(content)

    expect(maskedContent).toHaveLength(content.length)
    expect(maskedContent).toContain('"fetchFile"')
    expect(maskedContent).not.toContain('disabled')
  })
})
