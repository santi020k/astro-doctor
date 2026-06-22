import { execFileSync } from 'node:child_process'

import { isProjectAuditRelevantPath } from './scanner/project-audit.js'

const isScanRelevantPath = (filePath: string): boolean =>
  filePath.endsWith('.astro') || isProjectAuditRelevantPath(filePath)

/**
 * Run a git command and return stdout lines, or throw with a clean message on failure.
 */
const git = (args: string[], cwd: string): string[] => {
  try {
    const output = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

    return output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const subcommand = args[0] ?? 'command'

    throw new Error(`git ${subcommand} failed: ${message}`, { cause: error })
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

/**
 * Return absolute paths of Astro Doctor files currently staged (git add-ed) in the given directory.
 */
export const getStagedAstroFiles = (cwd: string): string[] => {
  const lines = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], cwd)

  return lines
    .filter((line) => isScanRelevantPath(line))
    .map((line) => `${cwd}/${line}`)
}

/**
 * Return absolute paths of Astro Doctor files changed compared to a base ref.
 * Defaults to auto-detecting the default branch (main → master → HEAD~1).
 */
export const getDiffAstroFiles = (cwd: string, base?: string): string[] => {
  const resolvedBase = base ?? detectDefaultBase(cwd)
  const lines = git(['diff', '--name-only', '--diff-filter=ACMR', resolvedBase, 'HEAD'], cwd)

  return lines
    .filter((line) => isScanRelevantPath(line))
    .map((line) => `${cwd}/${line}`)
}
