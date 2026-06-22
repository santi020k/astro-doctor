import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { glob } from 'glob'

import { scan } from './scanner/index.js'
import { loadConfig } from './config.js'
import { computeCategoryBreakdown,computeScore, computeScoreLabel } from './scorer.js'
import type {
  AstroDoctorConfig,
  ProjectScanResult,
  ScanOptions,
  ScanResult,
} from './types.js'

interface WorkspacePackage {
  readonly name: string
  readonly directory: string
}

interface MultiProjectOptions {
  readonly rootDirectory: string
  readonly projectArgs: readonly string[]
  readonly rootConfig: AstroDoctorConfig | null
  readonly scanOptions: Omit<ScanOptions, 'directory' | 'ignore' | 'rules'>
}

/**
 * Read workspace package names from pnpm-workspace.yaml, package.json workspaces,
 * or yarn workspaces — return every workspace directory with its package name.
 */
const discoverWorkspacePackages = async (rootDirectory: string): Promise<WorkspacePackage[]> => {
  const packages: WorkspacePackage[] = []
  // Try pnpm-workspace.yaml first
  const pnpmWorkspacePath = join(rootDirectory, 'pnpm-workspace.yaml')
  let globs: string[] = []

  if (existsSync(pnpmWorkspacePath)) {
    const content = readFileSync(pnpmWorkspacePath, 'utf8')
    // Simple YAML array parsing — covers the common `packages:\n  - "packages/*"` shape
    const matches = content.matchAll(/^\s+-\s+"?([^"#\n]+)"?/gmu)

    for (const match of matches) {
      const pattern = match[1]?.trim()

      if (pattern) globs.push(pattern)
    }
  }

  // Fall back to package.json workspaces
  if (globs.length === 0) {
    const packageJsonPath = join(rootDirectory, 'package.json')

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
          workspaces?: string[] | { packages?: string[] }
        }

        const workspaces = packageJson.workspaces

        if (Array.isArray(workspaces)) {
          globs = workspaces
        } else if (workspaces?.packages) {
          globs = workspaces.packages
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  // Expand globs into directories
  for (const pattern of globs) {
    const directoryPaths = await glob(pattern, {
      cwd: rootDirectory,
      absolute: true,
    })

    for (const directoryPath of directoryPaths) {
      if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) continue

      const packageJsonPath = join(directoryPath, 'package.json')

      if (!existsSync(packageJsonPath)) continue

      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string }
        const name = packageJson.name ?? directoryPath.replace(`${rootDirectory}/`, '')

        packages.push({ name, directory: directoryPath })
      } catch {
        const name = directoryPath.replace(`${rootDirectory}/`, '')

        packages.push({ name, directory: directoryPath })
      }
    }
  }

  return packages
}

/**
 * Resolve --project values (package names or relative paths) to absolute directories.
 * Unknown entries cause a hard exit to match react-doctor behaviour.
 */
export const resolveProjectDirectories = async (
  projectArgs: readonly string[],
  rootDirectory: string,
): Promise<WorkspacePackage[]> => {
  const workspacePackages = await discoverWorkspacePackages(rootDirectory)
  const resolved: WorkspacePackage[] = []
  let hasError = false

  for (const arg of projectArgs) {
    // Try exact package name match
    const byName = workspacePackages.find((p) => p.name === arg)

    if (byName) {
      resolved.push(byName)

      continue
    }

    // Try as a relative path
    const absoluteDir = resolve(rootDirectory, arg)

    if (existsSync(absoluteDir)) {
      const pkgJsonPath = join(absoluteDir, 'package.json')

      const name = existsSync(pkgJsonPath)
        ? ((JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { name?: string }).name ?? arg)
        : arg

      resolved.push({ name, directory: absoluteDir })

      continue
    }

    console.error(`\nUnknown project "${arg}": not a workspace package name or valid path.\n`)

    hasError = true
  }

  if (hasError) process.exitCode = 1

  return resolved
}

/**
 * Merge root config with a project-level config.
 * Project-level rules and ignore lists layer on top; failOn and threshold are overridden only
 * when the project config explicitly sets them.
 */
const mergeConfigs = (
  root: AstroDoctorConfig | null,
  project: AstroDoctorConfig | null,
): AstroDoctorConfig => ({
  rules: { ...(root?.rules ?? {}), ...(project?.rules ?? {}) },
  ignore: [...(root?.ignore ?? []), ...(project?.ignore ?? [])],
  failOn: project?.failOn ?? root?.failOn,
  threshold: project?.threshold ?? root?.threshold,
})

/** Aggregate multiple scan results into a single worst-of result. */
export const aggregateResults = (results: readonly ProjectScanResult[]): ScanResult => {
  if (results.length === 0) {
    return {
      diagnostics: [],
      fileCount: 0,
      errorCount: 0,
      warningCount: 0,
      score: 100,
      scoreLabel: 'A',
      scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 },
    }
  }

  const diagnostics = results.flatMap((r) => [...r.diagnostics])
  const fileCount = results.reduce((sum, r) => sum + r.fileCount, 0)
  const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0)
  const warningCount = results.reduce((sum, r) => sum + r.warningCount, 0)
  const score = computeScore(diagnostics, fileCount)
  const scoreLabel = computeScoreLabel(score)
  const scoreBreakdown = computeCategoryBreakdown(diagnostics, fileCount)

  return { diagnostics, fileCount, errorCount, warningCount, score, scoreLabel, scoreBreakdown }
}

/** Scan each project individually, applying layered config. */
export const scanProjects = async (options: MultiProjectOptions): Promise<ProjectScanResult[]> => {
  const { rootDirectory, projectArgs, rootConfig, scanOptions } = options
  const projects = await resolveProjectDirectories(projectArgs, rootDirectory)

  if (projects.length === 0) return []

  const results: ProjectScanResult[] = []

  for (const project of projects) {
    const projectConfig = await loadConfig(project.directory)
    const mergedConfig = mergeConfigs(rootConfig, projectConfig)

    const result = await scan({
      ...scanOptions,
      directory: project.directory,
      ignore: mergedConfig.ignore,
      rules: mergedConfig.rules,
    })

    results.push({ ...result, name: project.name, directory: project.directory })
  }

  return results
}
