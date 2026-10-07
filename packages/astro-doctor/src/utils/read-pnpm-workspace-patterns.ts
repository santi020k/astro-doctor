import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseYAML } from 'confbox/yaml'

const PNPM_WORKSPACE_FILE_NAME = 'pnpm-workspace.yaml'
const PACKAGES_KEY = 'packages'
const isUnknownRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')

export const readPnpmWorkspacePatterns = (rootDirectory: string): string[] => {
  const pnpmWorkspacePath = join(rootDirectory, PNPM_WORKSPACE_FILE_NAME)

  if (!existsSync(pnpmWorkspacePath)) return []

  let workspaceConfig: unknown

  try {
    workspaceConfig = parseYAML(readFileSync(pnpmWorkspacePath, 'utf8'))
  } catch {
    return []
  }

  if (!isUnknownRecord(workspaceConfig)) return []

  const packages = workspaceConfig[PACKAGES_KEY]

  return isStringArray(packages) ? packages : []
}
