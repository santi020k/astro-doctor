import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

describe('GitHub Action', () => {
  test('includes Astro action files in the PR relevance filter', () => {
    const actionFileContent = readFileSync(
      resolve(import.meta.dirname, '../../../action.yml'),
      'utf8',
    )

    expect(actionFileContent).toContain('(^|/)src/actions/')
  })
})
