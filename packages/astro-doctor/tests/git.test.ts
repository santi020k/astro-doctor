import { execFileSync } from 'node:child_process'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { getDiffAstroFiles, getStagedAstroFiles } from '../src/git.js'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn()
}))

const mockExec = vi.mocked(execFileSync)

/** Encode paths exactly as `git diff --name-only -z` emits them: NUL-terminated, unquoted. */
const nulDelimited = (paths: string[]): string => paths.map(path => `${path}\0`).join('')

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getStagedAstroFiles
// ---------------------------------------------------------------------------

describe('getStagedAstroFiles', () => {
  test('returns absolute paths for staged .astro files', () => {
    mockExec.mockReturnValueOnce(nulDelimited(['src/pages/index.astro', 'src/pages/about.astro']))
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro', '/project/src/pages/about.astro'])
  })

  test('filters out non-astro-doctor files', () => {
    mockExec.mockReturnValueOnce(nulDelimited(['src/pages/index.astro', 'src/styles/main.css', 'README.md']))
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro'])
  })

  test('returns empty array when no staged files match', () => {
    mockExec.mockReturnValueOnce(nulDelimited(['src/styles/main.css', 'README.md']))
    const result = getStagedAstroFiles('/project')

    expect(result).toHaveLength(0)
  })

  test('returns empty array when git output is empty', () => {
    mockExec.mockReturnValueOnce('')
    const result = getStagedAstroFiles('/project')

    expect(result).toHaveLength(0)
  })

  test('includes project-audit-relevant files (e.g. package.json)', () => {
    mockExec.mockReturnValueOnce(nulDelimited(['src/pages/index.astro', 'package.json']))
    const result = getStagedAstroFiles('/project')

    expect(result).toContain('/project/src/pages/index.astro')
    expect(result).toContain('/project/package.json')
  })

  test('includes custom Astro 7 fetch entrypoint candidates', () => {
    mockExec.mockReturnValueOnce(nulDelimited(['source/server/handler.mts', 'src/styles/main.css']))
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual(['/project/source/server/handler.mts'])
  })

  test('throws a descriptive error when git fails', () => {
    mockExec.mockImplementationOnce(() => {
      throw new Error('not a git repository')
    })

    expect(() => getStagedAstroFiles('/project')).toThrow(/git diff failed/)
  })

  test('requests --relative --name-only -z so output is unquoted and cwd-relative', () => {
    mockExec.mockReturnValueOnce(nulDelimited(['src/pages/index.astro']))
    getStagedAstroFiles('/project')

    const [, args] = mockExec.mock.calls[0]

    expect(args).toEqual(
      expect.arrayContaining(['diff', '--cached', '--relative', '--name-only', '-z', '--diff-filter=ACMR'])
    )
  })

  test('preserves Unicode filenames that git would otherwise C-quote without -z', () => {
    const unicodeFileName = 'ページ-索引-日本語.astro'

    mockExec.mockReturnValueOnce(nulDelimited([unicodeFileName]))
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual([`/project/${unicodeFileName}`])
  })

  test('preserves tabs and embedded newlines that -z keeps literal inside a NUL-delimited entry', () => {
    const tabbedFileName = 'src/pages/weird\tname.astro'
    const newlineFileName = 'src/pages/weird\nname.astro'

    mockExec.mockReturnValueOnce(nulDelimited([tabbedFileName, newlineFileName]))
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual([`/project/${tabbedFileName}`, `/project/${newlineFileName}`])
  })

  test('does not trim leading or trailing whitespace from a NUL-delimited path', () => {
    const spacedFileName = 'src/pages/ leading and trailing .astro'

    mockExec.mockReturnValueOnce(nulDelimited([spacedFileName]))
    const result = getStagedAstroFiles('/project')

    expect(result).toEqual([`/project/${spacedFileName}`])
  })
})

// ---------------------------------------------------------------------------
// getDiffAstroFiles
// ---------------------------------------------------------------------------

describe('getDiffAstroFiles', () => {
  test('rejects base values that would be interpreted as git options', () => {
    expect(() => getDiffAstroFiles('/project', '--no-index')).toThrow('Invalid base revision')
    expect(mockExec).not.toHaveBeenCalled()
  })
  test('passes the provided base to git diff', () => {
    mockExec.mockReturnValue(nulDelimited(['src/pages/index.astro']))
    getDiffAstroFiles('/project', 'develop')

    const [, args] = mockExec.mock.calls[mockExec.mock.calls.length - 1]

    expect(args).toContain('develop')
  })

  test('returns absolute paths for changed .astro files', () => {
    mockExec.mockReturnValue(nulDelimited(['src/pages/index.astro']))
    const result = getDiffAstroFiles('/project', 'main')

    expect(result).toEqual(['/project/src/pages/index.astro'])
  })

  test('requests --relative --name-only -z so output is unquoted and cwd-relative', () => {
    mockExec.mockReturnValue(nulDelimited(['src/pages/index.astro']))
    getDiffAstroFiles('/project', 'main')

    const [, args] = mockExec.mock.calls[mockExec.mock.calls.length - 1]

    expect(args).toEqual(
      expect.arrayContaining(['diff', '--relative', '--name-only', '-z', '--diff-filter=ACMR', 'main', 'HEAD'])
    )
  })

  test('preserves filenames containing spaces and Unicode characters', () => {
    const spacedUnicodeFileName = 'カフェ 分析 😊.astro'

    mockExec.mockReturnValue(nulDelimited([spacedUnicodeFileName]))
    const result = getDiffAstroFiles('/project', 'main')

    expect(result).toEqual([`/project/${spacedUnicodeFileName}`])
  })

  test('auto-detects the base branch when none is provided', () => {
    // First call: rev-parse main (succeeds), second call: git diff
    mockExec
      .mockReturnValueOnce('abc123')
      .mockReturnValueOnce(nulDelimited(['src/pages/index.astro']))

    const result = getDiffAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro'])

    const firstCall = mockExec.mock.calls[0]

    expect(firstCall[1]).toContain('main')
  })

  test('falls back to HEAD~1 when no known branch exists', () => {
    // All rev-parse calls fail, then git diff succeeds
    mockExec
      .mockImplementationOnce(() => {
        throw new Error('no main')
      })
      .mockImplementationOnce(() => {
        throw new Error('no master')
      })
      .mockImplementationOnce(() => {
        throw new Error('no origin/main')
      })
      .mockImplementationOnce(() => {
        throw new Error('no origin/master')
      })
      .mockReturnValueOnce(nulDelimited(['src/pages/index.astro']))

    const result = getDiffAstroFiles('/project')

    expect(result).toEqual(['/project/src/pages/index.astro'])

    const diffCall = mockExec.mock.calls[mockExec.mock.calls.length - 1]

    expect(diffCall[1]).toContain('HEAD~1')
  })
})
