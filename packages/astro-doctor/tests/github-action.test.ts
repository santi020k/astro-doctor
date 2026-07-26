import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const actionFileContent = readFileSync(
  resolve(import.meta.dirname, '../../../action.yml'),
  'utf8',
)

describe('GitHub Action', () => {
  test('includes Astro action files in the PR relevance filter', () => {
    expect(actionFileContent).toContain('(^|/)src/actions/')
  })

  test('skips PR comments when GitHub provides a read-only token', () => {
    expect(actionFileContent).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    )
    expect(actionFileContent).toContain("github.actor != 'dependabot[bot]'")
  })

  test('supports a minimum health score gate', () => {
    expect(actionFileContent).toContain('min-score:')
    expect(actionFileContent).toContain('MIN_SCORE="${{ inputs.min-score }}"')
    expect(actionFileContent).toContain('Astro Doctor score $SCORE/100 is below the minimum of $MIN_SCORE.')
  })

  test('does not create an unused changed-files manifest', () => {
    expect(actionFileContent).not.toContain('CHANGED_FILES_FILE')
    expect(actionFileContent).not.toContain('changed_files_from')
  })
})
