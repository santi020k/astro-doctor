import { describe, expect, test } from 'vitest'

import { isFileInDirectory } from '../../src/utils/is-file-in-directory.js'

describe('isFileInDirectory', () => {
  test('accepts nested files', () => {
    expect(isFileInDirectory('/workspace/app/src/index.astro', '/workspace/app')).toBe(true)
  })

  test('rejects sibling directories with the same prefix', () => {
    expect(isFileInDirectory('/workspace/app-old/index.astro', '/workspace/app')).toBe(false)
  })
})
