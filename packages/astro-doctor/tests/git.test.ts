import { execFileSync } from 'node:child_process'

import { afterEach,describe, expect, test, vi } from 'vitest'

import { getDiffAstroFiles, getStagedAstroFiles } from '../src/git.js'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

const mockExec = execFileSync as ReturnType<typeof vi.fn>

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getStagedAstroFiles
// ---------------------------------------------------------------------------

describe('getStagedAstroFiles', () => {
  test('returns absolute paths for staged .astro files', () => {
    mockExec.mockReturnValueOnce('src/pages/index.astro\nsrc/pages/about.astro\n')
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro', '/project/src/pages/about.astro'])
  })

  test('filters out non-astro-doctor files', () => {
    mockExec.mockReturnValueOnce('src/pages/index.astro\nsrc/styles/main.css\nREADME.md\n')
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro'])
  })

  test('returns empty array when no staged files match', () => {
    mockExec.mockReturnValueOnce('src/styles/main.css\nREADME.md\n')
    const result = getStagedAstroFiles('/project')

    expect(result).toHaveLength(0)
  })

  test('returns empty array when git output is empty', () => {
    mockExec.mockReturnValueOnce('')
    const result = getStagedAstroFiles('/project')

    expect(result).toHaveLength(0)
  })

  test('includes project-audit-relevant files (e.g. package.json)', () => {
    mockExec.mockReturnValueOnce('src/pages/index.astro\npackage.json\n')
    const result = getStagedAstroFiles('/project')

    expect(result).toContain('/project/src/pages/index.astro')
    expect(result).toContain('/project/package.json')
  })

  test('throws a descriptive error when git fails', () => {
    mockExec.mockImplementationOnce(() => {
      throw new Error('not a git repository')
    })

    expect(() => getStagedAstroFiles('/project')).toThrow(/git diff failed/)
  })
})

// ---------------------------------------------------------------------------
// getDiffAstroFiles
// ---------------------------------------------------------------------------

describe('getDiffAstroFiles', () => {
  test('passes the provided base to git diff', () => {
    mockExec.mockReturnValue('src/pages/index.astro\n')
    getDiffAstroFiles('/project', 'develop')

    const [, args] = mockExec.mock.calls[mockExec.mock.calls.length - 1] as [string, string[]]

    expect(args).toContain('develop')
  })

  test('returns absolute paths for changed .astro files', () => {
    mockExec.mockReturnValue('src/pages/index.astro\n')
    const result = getDiffAstroFiles('/project', 'main')

    expect(result).toEqual(['/project/src/pages/index.astro'])
  })

  test('auto-detects the base branch when none is provided', () => {
    // First call: rev-parse main (succeeds), second call: git diff
    mockExec
      .mockReturnValueOnce('abc123')
      .mockReturnValueOnce('src/pages/index.astro\n')

    const result = getDiffAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro'])

    const firstCall = mockExec.mock.calls[0] as [string, string[]]

    expect(firstCall[1]).toContain('main')
  })

  test('falls back to HEAD~1 when no known branch exists', () => {
    // All rev-parse calls fail, then git diff succeeds
    mockExec
      .mockImplementationOnce(() => { throw new Error('no main') })
      .mockImplementationOnce(() => { throw new Error('no master') })
      .mockImplementationOnce(() => { throw new Error('no origin/main') })
      .mockImplementationOnce(() => { throw new Error('no origin/master') })
      .mockReturnValueOnce('src/pages/index.astro\n')

    const result = getDiffAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro'])

    const diffCall = mockExec.mock.calls[mockExec.mock.calls.length - 1] as [string, string[]]

    expect(diffCall[1]).toContain('HEAD~1')
  })
})
