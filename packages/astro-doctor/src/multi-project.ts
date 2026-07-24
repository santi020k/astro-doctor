import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { glob } from 'glob'

import { scan } from './scanner/index.js'
import { isFileInDirectory } from './utils/is-file-in-directory.js'
import { readPnpmWorkspacePatterns } from './utils/read-pnpm-workspace-patterns.js'
import { loadConfig } from './config.js'
import { computeScoreLabel } from './scorer.js'
import type {
  AstroDoctorConfig,
  ProjectScanResult,
  ScanOptions,
  ScanResult,
} from './types.js'

export interface WorkspacePackage {
  readonly name: string
  readonly directory: string
}

interface MultiProjectOptions {
  readonly rootDirectory: string
  readonly projectArgs: readonly string[]
  readonly rootConfig: AstroDoctorConfig | null
  readonly scanOptions: Omit<ScanOptions, 'directory' | 'ignore' | 'rules'>
}

const readPackageJsonWorkspaceGlobs = (rootDirectory: string): string[] => {
  const packageJsonPath = join(rootDirectory, 'package.json')

  if (!existsSync(packageJsonPath)) return []

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      workspaces?: string[] | { packages?: string[] }
    }

    const workspaces = packageJson.workspaces

    if (Array.isArray(workspaces)) return workspaces

    if (workspaces?.packages) return workspaces.packages
  } catch {
    // ignore parse errors
  }

  return []
}

const resolveDirectoryPackage = (directoryPath: string, rootDirectory: string): WorkspacePackage | null => {
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) return null

  const packageJsonPath = join(directoryPath, 'package.json')

  if (!existsSync(packageJsonPath)) return null

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string }
    const name = packageJson.name ?? directoryPath.replace(`${rootDirectory}/`, '')

    return { name, directory: directoryPath }
  } catch {
    const name = directoryPath.replace(`${rootDirectory}/`, '')

    return { name, directory: directoryPath }
  }
}

/**
 * Read workspace package names from pnpm-workspace.yaml, package.json workspaces,
 * or yarn workspaces — return every workspace directory with its package name.
 */
export const discoverWorkspacePackages = async (rootDirectory: string): Promise<WorkspacePackage[]> => {
  const pnpmGlobs = readPnpmWorkspacePatterns(rootDirectory)
  const globs = pnpmGlobs.length > 0 ? pnpmGlobs : readPackageJsonWorkspaceGlobs(rootDirectory)
  const packages: WorkspacePackage[] = []

  for (const pattern of globs) {
    const directoryPaths = await glob(pattern, { cwd: rootDirectory, absolute: true })

    for (const directoryPath of directoryPaths) {
      const pkg = resolveDirectoryPackage(directoryPath, rootDirectory)

      if (pkg) packages.push(pkg)
    }
  }

  return packages
}

const hasAstroConfigFile = (directory: string): boolean =>
  existsSync(join(directory, 'astro.config.mjs')) ||
  existsSync(join(directory, 'astro.config.ts')) ||
  existsSync(join(directory, 'astro.config.js')) ||
  existsSync(join(directory, 'astro.config.cjs'))

export const isAstroProject = (directory: string): boolean => {
  if (hasAstroConfigFile(directory)) return true

  const packageJsonPath = join(directory, 'package.json')

  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }

      if (pkg.dependencies?.astro || pkg.devDependencies?.astro) return true
    } catch {
      // ignore JSON parse errors
    }
  }

  return false
}

export const autoDiscoverAstroProjects = async (rootDirectory: string): Promise<WorkspacePackage[]> => {
  const packages = await discoverWorkspacePackages(rootDirectory)

  return packages.filter((pkg) => isAstroProject(pkg.directory))
}

/**
 * Resolve --project values (package names or relative paths) to absolute directories.
 * Unknown entries cause a hard exit to match react-doctor behavior.
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

const mergeRules = (
  root: AstroDoctorConfig | null,
  project: AstroDoctorConfig | null,
): AstroDoctorConfig['rules'] => ({
  ...(root?.rules ?? {}),
  ...(project?.rules ?? {}),
})

const mergeIgnore = (
  root: AstroDoctorConfig | null,
  project: AstroDoctorConfig | null,
): AstroDoctorConfig['ignore'] => [
  ...(root?.ignore ?? []),
  ...(project?.ignore ?? []),
]

const mergeOverrides = (
  root: AstroDoctorConfig | null,
  project: AstroDoctorConfig | null,
): AstroDoctorConfig['overrides'] => [
  ...(root?.overrides ?? []),
  ...(project?.overrides ?? []),
]

/**
 * Merge root config with a project-level config.
 * Project-level rules and ignore lists layer on top; failOn and threshold are overridden only
 * when the project config explicitly sets them.
 */
export const mergeConfigs = (
  root: AstroDoctorConfig | null,
  project: AstroDoctorConfig | null,
): AstroDoctorConfig => ({
  rules: mergeRules(root, project),
  ignore: mergeIgnore(root, project),
  overrides: mergeOverrides(root, project),
  preset: project?.preset ?? root?.preset,
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
      scoreLabel: 'S',
      scoreBreakdown: { performance: 100, accessibility: 100, security: 100, 'best-practices': 100 },
    }
  }

  const diagnostics = results.flatMap((r) => [...r.diagnostics])
  const fileCount = results.reduce((sum, r) => sum + r.fileCount, 0)
  const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0)
  const warningCount = results.reduce((sum, r) => sum + r.warningCount, 0)
  const score = Math.min(...results.map((result) => result.score))
  const scoreLabel = computeScoreLabel(score)

  const scoreBreakdown = {
    performance: Math.min(...results.map((result) => result.scoreBreakdown.performance)),
    accessibility: Math.min(...results.map((result) => result.scoreBreakdown.accessibility)),
    security: Math.min(...results.map((result) => result.scoreBreakdown.security)),
    'best-practices': Math.min(
      ...results.map((result) => result.scoreBreakdown['best-practices']),
    ),
  }

  const timings = results.some((result) => result.timings !== undefined)
    ? {
        discoveryMs: results.reduce((total, result) => total + (result.timings?.discoveryMs ?? 0), 0),
        auditMs: results.reduce((total, result) => total + (result.timings?.auditMs ?? 0), 0),
        lintMs: results.reduce((total, result) => total + (result.timings?.lintMs ?? 0), 0),
        totalMs: results.reduce((total, result) => total + (result.timings?.totalMs ?? 0), 0),
        cacheEnabled: results.every((result) => Boolean(result.timings?.cacheEnabled)),
      }
    : undefined

  return {
    diagnostics,
    fileCount,
    errorCount,
    warningCount,
    score,
    scoreLabel,
    scoreBreakdown,
    ...(timings === undefined ? {} : { timings }),
  }
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

    const projectFiles = scanOptions.files?.filter((filePath) =>
      isFileInDirectory(filePath, project.directory)
    )

    const result = await scan({
      ...scanOptions,
      directory: project.directory,
      files: projectFiles,
      ignore: mergedConfig.ignore,
      rules: mergedConfig.rules,
      overrides: mergedConfig.overrides,
    })

    results.push({ ...result, name: project.name, directory: project.directory })
  }

  return results
}
