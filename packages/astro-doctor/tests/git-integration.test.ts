import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { getDiffAstroFiles, getStagedAstroFiles } from '../src/git.js'

const TEST_GIT_AUTHOR_NAME = 'Astro Doctor Test'
const TEST_GIT_AUTHOR_EMAIL = 'astro-doctor-test@example.com'

const runGit = (args: string[], cwd: string): void => {
  execFileSync('git', args, { cwd, stdio: ['ignore', 'ignore', 'ignore'] })
}

const initRepository = (repositoryDirectory: string): void => {
  runGit(['init', '--initial-branch=main'], repositoryDirectory)
  runGit(['config', 'user.name', TEST_GIT_AUTHOR_NAME], repositoryDirectory)
  runGit(['config', 'user.email', TEST_GIT_AUTHOR_EMAIL], repositoryDirectory)
}

const commitAll = (repositoryDirectory: string, message: string): void => {
  runGit(['add', '-A'], repositoryDirectory)
  runGit(['commit', '--no-gpg-sign', '-m', message], repositoryDirectory)
}

describe('git.ts with a real git repository', () => {
  let repositoryDirectory: string

  beforeEach(() => {
    repositoryDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-git-integration-'))
    initRepository(repositoryDirectory)
    writeFileSync(join(repositoryDirectory, 'README.md'), '# fixture\n')
    commitAll(repositoryDirectory, 'initial commit')
  })

  afterEach(() => {
    rmSync(repositoryDirectory, { recursive: true, force: true })
  })

  describe('getStagedAstroFiles', () => {
    test('resolves a staged Unicode filename without C-quote corruption', () => {
      const unicodeFileName = 'ページ-索引-日本語.astro'

      writeFileSync(join(repositoryDirectory, unicodeFileName), '---\n---\n<h1>Hola</h1>')
      runGit(['add', unicodeFileName], repositoryDirectory)

      const result = getStagedAstroFiles(repositoryDirectory)

      expect(result).toEqual([`${repositoryDirectory}/${unicodeFileName}`])
    })

    test('resolves a staged filename containing spaces', () => {
      const spacedFileName = 'my component page.astro'

      writeFileSync(join(repositoryDirectory, spacedFileName), '---\n---\n<h1>Hi</h1>')
      runGit(['add', spacedFileName], repositoryDirectory)

      const result = getStagedAstroFiles(repositoryDirectory)

      expect(result).toEqual([`${repositoryDirectory}/${spacedFileName}`])
    })

    test('resolves repo-relative paths correctly when cwd is a project subdirectory', () => {
      const subdirectoryName = 'apps/site'
      const relativeFilePath = 'src/pages/index.astro'
      const subdirectory = join(repositoryDirectory, subdirectoryName)

      mkdirSync(join(subdirectory, 'src', 'pages'), { recursive: true })
      writeFileSync(join(subdirectory, relativeFilePath), '---\n---\n<h1>Hi</h1>')
      runGit(['add', join(subdirectoryName, relativeFilePath)], repositoryDirectory)

      const result = getStagedAstroFiles(subdirectory)

      expect(result).toEqual([`${subdirectory}/${relativeFilePath}`])
    })
  })

  describe('getDiffAstroFiles', () => {
    test('resolves Unicode and spaced filenames changed relative to a base branch', () => {
      runGit(['checkout', '-b', 'feature'], repositoryDirectory)

      const unicodeSpacedFileName = 'カフェ 分析 😊.astro'

      writeFileSync(join(repositoryDirectory, unicodeSpacedFileName), '---\n---\n<h1>カフェ</h1>')
      commitAll(repositoryDirectory, 'add unicode page')

      const result = getDiffAstroFiles(repositoryDirectory, 'main')

      expect(result).toEqual([`${repositoryDirectory}/${unicodeSpacedFileName}`])
    })

    test('resolves repo-relative paths correctly when cwd is a project subdirectory', () => {
      const subdirectoryName = 'apps/site'
      const relativeFilePath = 'src/pages/about.astro'
      const subdirectory = join(repositoryDirectory, subdirectoryName)

      mkdirSync(join(subdirectory, 'src', 'pages'), { recursive: true })
      runGit(['checkout', '-b', 'feature'], repositoryDirectory)

      writeFileSync(join(subdirectory, relativeFilePath), '---\n---\n<h1>About</h1>')
      commitAll(repositoryDirectory, 'add about page')

      const result = getDiffAstroFiles(subdirectory, 'main')

      expect(result).toEqual([`${subdirectory}/${relativeFilePath}`])
    })

    test('auto-detects the main branch as the base when none is provided', () => {
      runGit(['checkout', '-b', 'feature'], repositoryDirectory)

      writeFileSync(join(repositoryDirectory, 'new-page.astro'), '---\n---\n<h1>New</h1>')
      commitAll(repositoryDirectory, 'add new page')

      const result = getDiffAstroFiles(repositoryDirectory)

      expect(result).toEqual([`${repositoryDirectory}/new-page.astro`])
    })
  })
})
