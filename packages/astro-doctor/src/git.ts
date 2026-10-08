import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { isProjectAuditRelevantPath } from './scanner/project-audit.js'

const isScanRelevantPath = (filePath: string): boolean => filePath.endsWith('.astro') || isProjectAuditRelevantPath(filePath)

/**
 * Run a git command and return raw stdout, or throw with a clean message on failure.
 */
const runGitCommand = (args: string[], cwd: string): string => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const subcommand = args[0] ?? 'command'

    throw new Error(`git ${subcommand} failed: ${message}`, { cause: error })
  }
}

/**
 * Run a git command and return trimmed, non-empty stdout lines.
 */
const git = (args: string[], cwd: string): string[] => runGitCommand(args, cwd)
  .split(/\r?\n/u)
  .map(line => line.trim())
  .filter(Boolean)

/**
 * Run a `git diff --name-only -z` command and return the NUL-delimited paths verbatim.
 * `-z` disables git's default C-quoting of Unicode, tabs, and newlines in paths, and
 * NUL (rather than newline) is the only safe delimiter for paths that may themselves
 * contain newlines, so entries must not be trimmed.
 */
const gitDiffPaths = (args: string[], cwd: string): string[] => runGitCommand(args, cwd)
  .split('\0')
  .filter(Boolean)

export const extractRevision = (
  cwd: string,
  revision: string,
  destinationDirectory: string
): void => {
  const archiveDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-git-archive-'))
  const archivePath = join(archiveDirectory, 'snapshot.tar')

  try {
    execFileSync('git', ['archive', '--format=tar', '--output', archivePath, revision], {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe']
    })

    execFileSync('tar', ['-xf', archivePath, '-C', destinationDirectory], {
      stdio: ['ignore', 'ignore', 'pipe']
    })
  } finally {
    rmSync(archiveDirectory, { recursive: true, force: true })
  }
}

const detectDefaultBase = (cwd: string): string => {
  for (const candidate of ['main', 'master', 'origin/main', 'origin/master']) {
    try {
      git(['rev-parse', '--verify', candidate], cwd)

      return candidate
    } catch {
      // not found, try next
    }
  }

  // Fallback to parent commit
  return 'HEAD~1'
}

export const resolveBaseRevision = (cwd: string, base?: string): string => {
  const requestedBase = base ?? detectDefaultBase(cwd)
  const revision = git(['rev-parse', '--verify', '--end-of-options', `${requestedBase}^{commit}`], cwd)[0]

  if (!revision) throw new Error(`Unable to resolve base revision "${requestedBase}".`)

  return revision
}

/**
 * Return absolute paths of Astro Doctor files currently staged (git add-ed) in the given directory.
 */
export const getStagedAstroFiles = (cwd: string): string[] => {
  const paths = gitDiffPaths(
    ['diff', '--cached', '--relative', '--name-only', '-z', '--diff-filter=ACMR'],
    cwd
  )

  return paths
    .filter(path => isScanRelevantPath(path))
    .map(path => `${cwd}/${path}`)
}

/**
 * Return absolute paths of Astro Doctor files changed compared to a base ref.
 * Defaults to auto-detecting the default branch (main → master → HEAD~1).
 */
export const getDiffAstroFiles = (cwd: string, base?: string): string[] => {
  const resolvedBase = base ?? detectDefaultBase(cwd)

  if (resolvedBase.startsWith('-')) throw new Error(`Invalid base revision "${resolvedBase}".`)

  const paths = gitDiffPaths(
    ['diff', '--relative', '--name-only', '-z', '--diff-filter=ACMR', resolvedBase, 'HEAD', '--'],
    cwd
  )

  return paths
    .filter(path => isScanRelevantPath(path))
    .map(path => `${cwd}/${path}`)
}
