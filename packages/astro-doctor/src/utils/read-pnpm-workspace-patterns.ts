import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const readPnpmWorkspacePatterns = (rootDirectory: string): string[] => {
  const pnpmWorkspacePath = join(rootDirectory, 'pnpm-workspace.yaml')

  if (!existsSync(pnpmWorkspacePath)) return []

  const content = readFileSync(pnpmWorkspacePath, 'utf8')
  const matches = content.matchAll(/^\s+-\s+([^#\n]+)/gmu)
  const patterns: string[] = []

  for (const match of matches) {
    let pattern = match[1]?.trim()

    if (!pattern) continue

    if (
      (pattern.startsWith("'") && pattern.endsWith("'")) ||
      (pattern.startsWith('"') && pattern.endsWith('"'))
    ) {
      pattern = pattern.slice(1, -1)
    }

    patterns.push(pattern)
  }

  return patterns
}
