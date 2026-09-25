import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'

import { globSync } from 'glob'

import {
  DEFAULT_DIAGNOSTIC_COLUMN_NUMBER,
  DEFAULT_DIAGNOSTIC_LINE_NUMBER
} from '../constants.js'
import { getProjectRuleMeta } from '../project-rules.js'
import type { Diagnostic, ScanOptions, Severity } from '../types.js'
import { maskCodeLiterals } from '../utils/mask-code-literals.js'
import { readPnpmWorkspacePatterns } from '../utils/read-pnpm-workspace-patterns.js'

import { buildIgnorePatterns } from './file-discovery.js'

const ASTRO_CONFIG_FILE_NAMES = [
  'astro.config.ts',
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.cjs',
  'astro.config.mts',
  'astro.config.cts'
]

const CONTENT_CONFIG_FILE_NAMES = [
  'src/content.config.ts',
  'src/content.config.mjs',
  'src/content.config.js',
  'src/content/config.ts',
  'src/content/config.mjs',
  'src/content/config.js'
]

const ASTRO_FETCH_ENTRYPOINT_EXTENSIONS = ['.ts', '.js', '.mjs', '.mts']
const DEFAULT_ASTRO_SOURCE_DIRECTORY = 'src'
const DEFAULT_ASTRO_FETCH_FILE_NAME = 'fetch'

const ASTRO_FETCH_ENTRYPOINT_FILE_NAMES = ASTRO_FETCH_ENTRYPOINT_EXTENSIONS.map(
  extension => `${DEFAULT_ASTRO_SOURCE_DIRECTORY}/${DEFAULT_ASTRO_FETCH_FILE_NAME}${extension}`
)

const ASTRO_7_EXPERIMENTAL_FLAG_MIGRATIONS = [
  {
    propertyName: 'advancedRouting',
    message: 'Remove experimental.advancedRouting. Advanced routing is stable in Astro 7 and uses src/fetch.* or the top-level fetchFile option.'
  },
  {
    propertyName: 'cache',
    message: 'Move experimental.cache to the top-level cache field for Astro 7.'
  },
  {
    propertyName: 'logger',
    message: 'Move experimental.logger to the top-level logger field for Astro 7.'
  },
  {
    propertyName: 'queuedRendering',
    message: 'Remove experimental.queuedRendering. Queued rendering is always enabled in Astro 7.'
  },
  {
    propertyName: 'routeRules',
    message: 'Move experimental.routeRules to the top-level routeRules field for Astro 7.'
  },
  {
    propertyName: 'rustCompiler',
    message: 'Remove experimental.rustCompiler. The Rust compiler is the only compiler in Astro 7.'
  }
]

const PACKAGE_FILE_NAME = 'package.json'

const COMPETING_LOCK_FILE_NAMES = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb'
]

const ENV_EXAMPLE_FILE_NAME = '.env.example'
const CONTENT_DIRECTORY_NAME = 'src/content'
const ACTIONS_DIRECTORY_NAME = 'src/actions'
const ACTION_FILE_GLOB = 'src/actions/**/*.{js,mjs,cjs,ts,mts,cts}'
const ASTRO_FILE_GLOB = '**/*.astro'
const PUBLIC_ENV_PREFIX = 'PUBLIC_'
const SECRET_ENV_NAME_PARTS = ['TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE', 'KEY']

const PROJECT_AUDIT_FILE_NAMES = [
  ...ASTRO_CONFIG_FILE_NAMES,
  ...CONTENT_CONFIG_FILE_NAMES,
  ...ASTRO_FETCH_ENTRYPOINT_FILE_NAMES,
  PACKAGE_FILE_NAME,
  ...COMPETING_LOCK_FILE_NAMES,
  ENV_EXAMPLE_FILE_NAME
]

interface Location {
  readonly line: number
  readonly column: number
}

interface ObjectRange {
  readonly openingIndex: number
  readonly closingIndex: number
}

interface InsecureCookieProperty {
  readonly propertyName: string
  readonly index: number
}

interface StaticConfigProperty {
  readonly value: string | null
}

interface ProjectAuditOptions {
  readonly directory: string
  readonly files?: readonly string[]
  readonly rules?: ScanOptions['rules']
  readonly astroFiles?: readonly string[]
  readonly ignore?: readonly string[]
}

interface AstroPackageManifest {
  readonly dependencies?: Record<string, unknown>
  readonly devDependencies?: Record<string, unknown>
  readonly version?: string
}

const isAstroPackageManifest = (value: unknown): value is AstroPackageManifest => typeof value === 'object' && value !== null

const readPackageManifest = (filePath: string): AstroPackageManifest | undefined => {
  if (!existsSync(filePath)) return undefined

  try {
    const packageManifest: unknown = JSON.parse(readFileSync(filePath, 'utf8'))

    return isAstroPackageManifest(packageManifest) ? packageManifest : undefined
  } catch {
    return undefined
  }
}

const getMajorVersion = (version: string | undefined): number | undefined => {
  const majorVersion = /^[^\d]*(\d+)/u.exec(version ?? '')?.[1]

  return majorVersion === undefined ? undefined : Number.parseInt(majorVersion, 10)
}

const getAstroMajorVersion = (rootDirectory: string): number | undefined => {
  const installedManifest = readPackageManifest(
    resolve(rootDirectory, 'node_modules/astro/package.json')
  )

  const installedMajorVersion = getMajorVersion(installedManifest?.version)

  if (installedMajorVersion !== undefined) return installedMajorVersion

  const projectManifest = readPackageManifest(
    resolve(rootDirectory, PACKAGE_FILE_NAME)
  )

  const declaredVersion = projectManifest?.dependencies?.astro ??
    projectManifest?.devDependencies?.astro

  if (typeof declaredVersion === 'string') {
    const declaredMajorVersion = getMajorVersion(declaredVersion)

    if (declaredMajorVersion !== undefined) return declaredMajorVersion
  }

  return undefined
}

const toProjectPath = (rootDirectory: string, filePath: string): string => (isAbsolute(filePath) ? relative(rootDirectory, filePath) : filePath).replaceAll('\\', '/')

export const isProjectAuditRelevantPath = (filePath: string): boolean => {
  const normalizedFilePath = filePath.replaceAll('\\', '/')

  return ASTRO_FETCH_ENTRYPOINT_EXTENSIONS.some(
    extension => normalizedFilePath.endsWith(extension)
  ) || PROJECT_AUDIT_FILE_NAMES.some(
    projectPath => normalizedFilePath === projectPath || normalizedFilePath.endsWith(`/${projectPath}`)
  ) || normalizedFilePath.startsWith(`${CONTENT_DIRECTORY_NAME}/`) ||
  normalizedFilePath.includes(`/${CONTENT_DIRECTORY_NAME}/`) ||
  normalizedFilePath.startsWith(`${ACTIONS_DIRECTORY_NAME}/`) ||
  normalizedFilePath.includes(`/${ACTIONS_DIRECTORY_NAME}/`)
}

const toAbsolutePath = (rootDirectory: string, projectPath: string): string => resolve(rootDirectory, projectPath)

const getSelectedProjectPaths = (
  rootDirectory: string,
  filePaths: readonly string[] | undefined
): Set<string> | undefined => filePaths === undefined ?
  undefined :
  new Set(filePaths.map(filePath => toProjectPath(rootDirectory, filePath)))

const isSelected = (
  selectedProjectPaths: Set<string> | undefined,
  projectPath: string
): boolean => selectedProjectPaths === undefined || selectedProjectPaths.has(projectPath)

const isAnySelected = (
  selectedProjectPaths: Set<string> | undefined,
  projectPaths: readonly string[]
): boolean => projectPaths.some(projectPath => isSelected(selectedProjectPaths, projectPath))

const isSelectedByPrefix = (
  selectedProjectPaths: Set<string> | undefined,
  projectPathPrefix: string
): boolean => selectedProjectPaths === undefined ||
  [...selectedProjectPaths].some(projectPath => projectPath.startsWith(projectPathPrefix))

const findExistingProjectFile = (
  rootDirectory: string,
  projectPaths: readonly string[]
): string | undefined => projectPaths.find(projectPath => existsSync(toAbsolutePath(rootDirectory, projectPath)))

const readProjectFile = (rootDirectory: string, projectPath: string): string | undefined => {
  const filePath = toAbsolutePath(rootDirectory, projectPath)

  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : undefined
}

const matchesWorkspacePattern = (
  workspaceDirectory: string,
  projectDirectory: string,
  pattern: string
): boolean => globSync(pattern, { cwd: workspaceDirectory, absolute: true })
  .some(matchedPath => resolve(matchedPath) === resolve(projectDirectory))

const isPnpmWorkspaceProject = (
  workspaceDirectory: string,
  projectDirectory: string
): boolean => {
  if (resolve(workspaceDirectory) === resolve(projectDirectory)) return true

  const patterns = readPnpmWorkspacePatterns(workspaceDirectory)
  const includedPatterns = patterns.filter(pattern => !pattern.startsWith('!'))

  const excludedPatterns = patterns
    .filter(pattern => pattern.startsWith('!'))
    .map(pattern => pattern.slice(1))

  const isIncluded = includedPatterns.some(
    pattern => matchesWorkspacePattern(workspaceDirectory, projectDirectory, pattern)
  )

  const isExcluded = excludedPatterns.some(
    pattern => matchesWorkspacePattern(workspaceDirectory, projectDirectory, pattern)
  )

  return isIncluded && !isExcluded
}

const findPnpmWorkspaceDirectory = (projectDirectory: string): string | undefined => {
  let currentDirectory = resolve(projectDirectory)
  let parentDirectory = dirname(currentDirectory)

  while (currentDirectory !== parentDirectory) {
    if (
      existsSync(resolve(currentDirectory, 'pnpm-workspace.yaml')) &&
      isPnpmWorkspaceProject(currentDirectory, projectDirectory)
    ) {
      return currentDirectory
    }

    currentDirectory = parentDirectory

    parentDirectory = dirname(currentDirectory)
  }

  return existsSync(resolve(currentDirectory, 'pnpm-workspace.yaml')) &&
    isPnpmWorkspaceProject(currentDirectory, projectDirectory) ?
    currentDirectory :
    undefined
}

const getLocation = (content: string, searchText: string): Location => {
  const matchIndex = content.indexOf(searchText)

  if (matchIndex === -1) {
    return {
      line: DEFAULT_DIAGNOSTIC_LINE_NUMBER,
      column: DEFAULT_DIAGNOSTIC_COLUMN_NUMBER
    }
  }

  const contentBeforeMatch = content.slice(0, matchIndex)
  const lines = contentBeforeMatch.split(/\r?\n/u)
  const lastLine = lines.at(-1) ?? ''

  return {
    line: lines.length,
    column: lastLine.length + DEFAULT_DIAGNOSTIC_COLUMN_NUMBER
  }
}

const getLocationAtIndex = (content: string, matchIndex: number): Location => {
  if (matchIndex < 0) {
    return {
      line: DEFAULT_DIAGNOSTIC_LINE_NUMBER,
      column: DEFAULT_DIAGNOSTIC_COLUMN_NUMBER
    }
  }

  const contentBeforeMatch = content.slice(0, matchIndex)
  const lines = contentBeforeMatch.split(/\r?\n/u)
  const lastLine = lines.at(-1) ?? ''

  return {
    line: lines.length,
    column: lastLine.length + DEFAULT_DIAGNOSTIC_COLUMN_NUMBER
  }
}

const findObjectRange = (
  maskedContent: string,
  openingIndex: number
): ObjectRange | undefined => {
  if (maskedContent[openingIndex] !== '{') return undefined

  let objectDepth = 0

  for (
    let characterIndex = openingIndex;
    characterIndex < maskedContent.length;
    characterIndex += 1
  ) {
    const character = maskedContent[characterIndex]

    if (character === '{') objectDepth += 1

    if (character !== '}') continue

    objectDepth -= 1

    if (objectDepth === 0) {
      return {
        openingIndex,
        closingIndex: characterIndex
      }
    }
  }

  return undefined
}

const findNextNonWhitespaceIndex = (content: string, startIndex: number): number => {
  for (let characterIndex = startIndex; characterIndex < content.length; characterIndex += 1) {
    if (!/\s/u.test(content[characterIndex] ?? '')) return characterIndex
  }

  return -1
}

const findTopLevelPropertyIndex = (
  maskedContent: string,
  objectRange: ObjectRange,
  propertyName: string,
  sourceContent = maskedContent
): number | undefined => {
  const propertyPattern = new RegExp(
    `^(?:${propertyName}|['"]${propertyName}['"])\\s*:`, 'u'
  )

  let objectDepth = 1

  for (
    let characterIndex = objectRange.openingIndex + 1;
    characterIndex < objectRange.closingIndex;
    characterIndex += 1
  ) {
    const character = maskedContent[characterIndex]

    if (character === '{') {
      objectDepth += 1

      continue
    }

    if (character === '}') {
      objectDepth -= 1

      continue
    }

    if (objectDepth !== 1) continue

    const previousCharacter = maskedContent[characterIndex - 1] ?? ''

    if (
      !/[A-Za-z0-9_$]/u.test(previousCharacter) &&
      propertyPattern.test(sourceContent.slice(characterIndex))
    ) {
      return characterIndex
    }
  }

  return undefined
}

const hasTopLevelProperty = (
  maskedContent: string,
  objectRange: ObjectRange,
  propertyName: string,
  sourceContent = maskedContent
): boolean => findTopLevelPropertyIndex(
  maskedContent, objectRange, propertyName, sourceContent
) !== undefined

const findTopLevelObjectProperty = (
  maskedContent: string,
  objectRange: ObjectRange,
  propertyName: string,
  sourceContent = maskedContent
): ObjectRange | undefined => {
  let objectDepth = 1

  for (
    let characterIndex = objectRange.openingIndex + 1;
    characterIndex < objectRange.closingIndex;
    characterIndex += 1
  ) {
    const character = maskedContent[characterIndex]

    if (character === '{') {
      objectDepth += 1

      continue
    }

    if (character === '}') {
      objectDepth -= 1

      continue
    }

    if (objectDepth !== 1) continue

    const previousCharacter = maskedContent[characterIndex - 1] ?? ''

    const propertyPattern = new RegExp(
      `^(?:${propertyName}|['"]${propertyName}['"])\\s*:\\s*\\{`, 'u'
    )

    const propertyMatch = propertyPattern.exec(sourceContent.slice(characterIndex))

    if (/[A-Za-z0-9_$]/u.test(previousCharacter) || propertyMatch === null) continue

    const propertyValueStartIndex = characterIndex + propertyMatch[0].lastIndexOf('{')
    const relativeOpeningIndex = sourceContent.slice(propertyValueStartIndex).indexOf('{')
    const propertyOpeningIndex = propertyValueStartIndex + relativeOpeningIndex

    return findObjectRange(maskedContent, propertyOpeningIndex)
  }

  return undefined
}

const getAstroConfigRootObjectRange = (
  maskedContent: string
): ObjectRange | undefined => {
  const defineConfigMatch = /\bexport\s+default\s+defineConfig\s*\(/u.exec(maskedContent)

  if (defineConfigMatch?.index !== undefined) {
    const defineConfigOpeningIndex =
      defineConfigMatch.index + defineConfigMatch[0].lastIndexOf('(')

    const rootOpeningIndex = findNextNonWhitespaceIndex(
      maskedContent, defineConfigOpeningIndex + 1
    )

    return findObjectRange(maskedContent, rootOpeningIndex)
  }

  const plainObjectMatch = /\bexport\s+default\s+/u.exec(maskedContent)

  if (plainObjectMatch?.index === undefined) return undefined

  const rootOpeningIndex = findNextNonWhitespaceIndex(
    maskedContent, plainObjectMatch.index + plainObjectMatch[0].length
  )

  return findObjectRange(maskedContent, rootOpeningIndex)
}

const getStaticConfigProperty = (
  configContent: string,
  maskedContent: string,
  rootObjectRange: ObjectRange,
  propertyName: string
): StaticConfigProperty | undefined => {
  const propertyIndex = findTopLevelPropertyIndex(
    maskedContent, rootObjectRange, propertyName, configContent
  )

  if (propertyIndex === undefined) return undefined

  const propertyContent = configContent.slice(propertyIndex)
  const propertyPrefix = `(?:${propertyName}|['"]${propertyName}['"])`
  const nullPropertyPattern = new RegExp(`^${propertyPrefix}\\s*:\\s*null\\b`, 'u')

  if (nullPropertyPattern.test(propertyContent)) return { value: null }

  const stringPropertyPattern = new RegExp(
    `^${propertyPrefix}\\s*:\\s*(['"])([^'"\\r\\n]*)\\1`, 'u'
  )

  const stringPropertyMatch = stringPropertyPattern.exec(propertyContent)

  return stringPropertyMatch?.[2] === undefined ?
    undefined :
    { value: stringPropertyMatch[2] }
}

const getEffectiveStaticConfigValue = (
  configContent: string,
  maskedContent: string,
  rootObjectRange: ObjectRange,
  propertyName: string,
  defaultValue: string
): string | null | undefined => hasTopLevelProperty(
  maskedContent, rootObjectRange, propertyName, configContent
) ?
  getStaticConfigProperty(
    configContent, maskedContent, rootObjectRange, propertyName
  )?.value :
  defaultValue

const getEffectiveSeverity = (
  ruleId: string,
  rules: ScanOptions['rules']
): Severity | undefined => {
  const ruleOverride = rules?.[ruleId]

  if (ruleOverride === 'off') return undefined

  if (ruleOverride === 'error') return 'error'

  if (ruleOverride === 'warn') return 'warning'

  const projectRuleMetadata = getProjectRuleMeta(ruleId)

  return projectRuleMetadata?.recommended ? projectRuleMetadata.severity : undefined
}

const createDiagnostic = (
  rootDirectory: string,
  rules: ScanOptions['rules'],
  ruleId: string,
  projectPath: string,
  message: string,
  location: Location = {
    line: DEFAULT_DIAGNOSTIC_LINE_NUMBER,
    column: DEFAULT_DIAGNOSTIC_COLUMN_NUMBER
  }
): Diagnostic | undefined => {
  const projectRuleMeta = getProjectRuleMeta(ruleId)
  const severity = getEffectiveSeverity(ruleId, rules)

  if (projectRuleMeta === undefined || severity === undefined) return undefined

  return {
    ruleId,
    severity,
    message,
    filePath: toAbsolutePath(rootDirectory, projectPath),
    line: location.line,
    column: location.column,
    category: projectRuleMeta.category
  }
}

const pushDiagnostic = (
  diagnostics: Diagnostic[],
  diagnostic: Diagnostic | undefined
): void => {
  if (diagnostic !== undefined) diagnostics.push(diagnostic)
}

const isPackageManagerAuditSelected = (
  selectedProjectPaths: Set<string> | undefined
): boolean => isSelected(selectedProjectPaths, PACKAGE_FILE_NAME) ||
  COMPETING_LOCK_FILE_NAMES.some(lockFileName => isSelected(selectedProjectPaths, lockFileName))

const getPackageManagerContent = (
  packageJsonContent: string,
  workspaceDirectory: string | undefined
): string | undefined => {
  if (packageJsonContent.includes('"packageManager"')) return packageJsonContent

  return workspaceDirectory === undefined ? undefined : readProjectFile(workspaceDirectory, PACKAGE_FILE_NAME)
}

const hasCompetingLockFile = (
  directories: ReadonlySet<string>
): boolean => [...directories].some(directory => COMPETING_LOCK_FILE_NAMES.some(
  lockFileName => existsSync(toAbsolutePath(directory, lockFileName))
))

const auditPackageManager = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  if (!isPackageManagerAuditSelected(selectedProjectPaths)) return

  const packageJsonContent = readProjectFile(options.directory, PACKAGE_FILE_NAME)

  if (packageJsonContent === undefined) return

  const workspaceDirectory = findPnpmWorkspaceDirectory(options.directory)

  const packageManagerContent = getPackageManagerContent(
    packageJsonContent, workspaceDirectory
  )

  const auditedDirectories = new Set([
    options.directory,
    ...(workspaceDirectory === undefined ? [] : [workspaceDirectory])
  ])

  const usesPnpm = packageManagerContent?.includes('"packageManager"') === true &&
    packageManagerContent.includes('"pnpm@')

  if (usesPnpm && !hasCompetingLockFile(auditedDirectories)) return

  pushDiagnostic(
    diagnostics, createDiagnostic(
      options.directory, options.rules, 'astro-doctor/prefer-pnpm', PACKAGE_FILE_NAME, 'Use pnpm consistently: declare it in packageManager at the package or workspace root and remove competing npm, Yarn, or Bun lockfiles.', getLocation(packageJsonContent, '"packageManager"')
    )
  )
}

const auditAstroSecurityConfig = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  const astroConfigProjectPath = findExistingProjectFile(options.directory, ASTRO_CONFIG_FILE_NAMES)

  if (astroConfigProjectPath === undefined || !isSelected(selectedProjectPaths, astroConfigProjectPath)) {
    return
  }

  const astroConfigContent = readProjectFile(options.directory, astroConfigProjectPath)

  if (astroConfigContent === undefined) return

  if (/checkOrigin\s*:\s*false/u.test(astroConfigContent)) {
    pushDiagnostic(
      diagnostics, createDiagnostic(
        options.directory, options.rules, 'astro-doctor/no-disabled-origin-check', astroConfigProjectPath, 'Do not disable Astro security.checkOrigin unless you have a specific CSRF mitigation in place.', getLocation(astroConfigContent, 'checkOrigin')
      )
    )
  }

  if (/allowedDomains\s*:\s*\[\s*\{\s*\}\s*\]/u.test(astroConfigContent)) {
    pushDiagnostic(
      diagnostics, createDiagnostic(
        options.directory, options.rules, 'astro-doctor/no-open-allowed-domains', astroConfigProjectPath, 'Avoid security.allowedDomains: [{}]. Configure explicit trusted host patterns instead.', getLocation(astroConfigContent, 'allowedDomains')
      )
    )
  }
}

const auditAstro7ExperimentalFlags = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  if ((getAstroMajorVersion(options.directory) ?? 0) < 7) return

  const astroConfigProjectPath = findExistingProjectFile(options.directory, ASTRO_CONFIG_FILE_NAMES)

  if (
    astroConfigProjectPath === undefined ||
    !isAnySelected(selectedProjectPaths, [PACKAGE_FILE_NAME, astroConfigProjectPath])
  ) {
    return
  }

  const astroConfigContent = readProjectFile(options.directory, astroConfigProjectPath)

  if (astroConfigContent === undefined) return

  const maskedContent = maskCodeLiterals(astroConfigContent)
  const rootObjectRange = getAstroConfigRootObjectRange(maskedContent)

  if (rootObjectRange === undefined) return

  const experimentalObjectRange = findTopLevelObjectProperty(
    maskedContent, rootObjectRange, 'experimental', astroConfigContent
  )

  if (experimentalObjectRange === undefined) return

  for (const migration of ASTRO_7_EXPERIMENTAL_FLAG_MIGRATIONS) {
    const propertyIndex = findTopLevelPropertyIndex(
      maskedContent, experimentalObjectRange, migration.propertyName, astroConfigContent
    )

    if (propertyIndex === undefined) continue

    pushDiagnostic(
      diagnostics, createDiagnostic(
        options.directory, options.rules, 'astro-doctor/no-legacy-astro-7-experimental-flags', astroConfigProjectPath, migration.message, getLocationAtIndex(astroConfigContent, propertyIndex)
      )
    )
  }
}

const hasDefaultExport = (maskedContent: string): boolean => {
  if (/\bexport\s+default\s+(?!(?:interface|type|declare)\b)/u.test(maskedContent)) {
    return true
  }

  const namedExportPattern = /\bexport\s*(?!type\b)\{([^}]*)\}/gu

  return [...maskedContent.matchAll(namedExportPattern)].some(namedExportMatch => (namedExportMatch[1] ?? '').split(',').some(exportSpecifier => {
    const normalizedSpecifier = exportSpecifier.trim()

    const isInlineTypeOnlyExport =
      /^type\s+[A-Za-z_$][\w$]*\s+as\s+default\b/u.test(normalizedSpecifier)

    return !isInlineTypeOnlyExport &&
      /^(?:default\b|[A-Za-z_$][\w$]*\s+as\s+default\b)/u.test(normalizedSpecifier)
  }))
}

const getFetchEntrypointProjectPaths = (
  rootDirectory: string,
  astroConfigProjectPath: string | undefined
): string[] | undefined => {
  if (astroConfigProjectPath === undefined) return [...ASTRO_FETCH_ENTRYPOINT_FILE_NAMES]

  const astroConfigContent = readProjectFile(rootDirectory, astroConfigProjectPath)

  if (astroConfigContent === undefined) return [...ASTRO_FETCH_ENTRYPOINT_FILE_NAMES]

  const maskedConfigContent = maskCodeLiterals(astroConfigContent)
  const rootObjectRange = getAstroConfigRootObjectRange(maskedConfigContent)

  if (rootObjectRange === undefined) return [...ASTRO_FETCH_ENTRYPOINT_FILE_NAMES]

  const sourceDirectory = getEffectiveStaticConfigValue(
    astroConfigContent,
    maskedConfigContent,
    rootObjectRange,
    'srcDir',
    DEFAULT_ASTRO_SOURCE_DIRECTORY
  )

  if (sourceDirectory === undefined || sourceDirectory === null) return undefined

  const fetchFileName = getEffectiveStaticConfigValue(
    astroConfigContent,
    maskedConfigContent,
    rootObjectRange,
    'fetchFile',
    DEFAULT_ASTRO_FETCH_FILE_NAME
  )

  if (fetchFileName === undefined) return undefined

  if (fetchFileName === null) return []

  const fetchEntrypointPath = resolve(rootDirectory, sourceDirectory, fetchFileName)
  const fetchEntrypointBaseProjectPath = toProjectPath(rootDirectory, fetchEntrypointPath)

  return extname(fetchFileName).length > 0 ?
    [fetchEntrypointBaseProjectPath] :
    ASTRO_FETCH_ENTRYPOINT_EXTENSIONS.map(
      extension => `${fetchEntrypointBaseProjectPath}${extension}`
    )
}

const auditFetchEntrypoint = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  if ((getAstroMajorVersion(options.directory) ?? 0) < 7) return

  const astroConfigProjectPath = findExistingProjectFile(options.directory, ASTRO_CONFIG_FILE_NAMES)

  const fetchEntrypointProjectPaths = getFetchEntrypointProjectPaths(
    options.directory, astroConfigProjectPath
  )

  if (fetchEntrypointProjectPaths === undefined) return

  const fetchEntrypointProjectPath = findExistingProjectFile(
    options.directory, fetchEntrypointProjectPaths
  )

  if (fetchEntrypointProjectPath === undefined) return

  const selectableProjectPaths = [PACKAGE_FILE_NAME, fetchEntrypointProjectPath]

  if (astroConfigProjectPath !== undefined) selectableProjectPaths.push(astroConfigProjectPath)

  if (!isAnySelected(selectedProjectPaths, selectableProjectPaths)) return

  const fetchEntrypointContent = readProjectFile(
    options.directory, fetchEntrypointProjectPath
  )

  if (
    fetchEntrypointContent === undefined ||
    hasDefaultExport(maskCodeLiterals(fetchEntrypointContent))
  ) {
    return
  }

  pushDiagnostic(
    diagnostics, createDiagnostic(
      options.directory, options.rules, 'astro-doctor/require-fetch-default-export', fetchEntrypointProjectPath, 'Astro 7 reserves src/fetch.* for advanced routing. Default-export a Fetchable handler, configure a different fetchFile, or set fetchFile to null if this is a utility module.'
    )
  )
}

const findInsecureCookieProperties = (
  maskedContent: string,
  cookieObjectRange: ObjectRange
): InsecureCookieProperty[] => {
  const insecureProperties: InsecureCookieProperty[] = []
  let objectDepth = 1

  for (
    let characterIndex = cookieObjectRange.openingIndex + 1;
    characterIndex < cookieObjectRange.closingIndex;
    characterIndex += 1
  ) {
    const character = maskedContent[characterIndex]

    if (character === '{') {
      objectDepth += 1

      continue
    }

    if (character === '}') {
      objectDepth -= 1

      continue
    }

    if (objectDepth !== 1) continue

    const previousCharacter = maskedContent[characterIndex - 1] ?? ''

    if (/[A-Za-z0-9_$]/u.test(previousCharacter)) continue

    const insecurePropertyMatch =
      /^(secure|httpOnly|sameSite)\s*:\s*false\b/u.exec(maskedContent.slice(characterIndex))

    if (insecurePropertyMatch === null) continue

    insecureProperties.push({
      propertyName: insecurePropertyMatch[1] ?? '',
      index: characterIndex
    })

    characterIndex += insecurePropertyMatch[0].length - 1
  }

  return insecureProperties
}

const auditSessionCookie = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  const astroConfigProjectPath = findExistingProjectFile(options.directory, ASTRO_CONFIG_FILE_NAMES)

  if (astroConfigProjectPath === undefined || !isSelected(selectedProjectPaths, astroConfigProjectPath)) {
    return
  }

  const astroConfigContent = readProjectFile(options.directory, astroConfigProjectPath)

  if (astroConfigContent === undefined) return

  const maskedContent = maskCodeLiterals(astroConfigContent)
  const defineConfigMatch = /\bdefineConfig\s*\(/u.exec(maskedContent)

  if (defineConfigMatch?.index === undefined) return

  const defineConfigOpeningIndex =
    defineConfigMatch.index + defineConfigMatch[0].lastIndexOf('(')

  const rootOpeningIndex = findNextNonWhitespaceIndex(
    maskedContent, defineConfigOpeningIndex + 1
  )

  const rootObjectRange = findObjectRange(maskedContent, rootOpeningIndex)

  if (rootObjectRange === undefined) return

  const sessionObjectRange = findTopLevelObjectProperty(maskedContent, rootObjectRange, 'session')

  if (sessionObjectRange === undefined) return

  const cookieObjectRange = findTopLevelObjectProperty(maskedContent, sessionObjectRange, 'cookie')

  if (cookieObjectRange === undefined) return

  for (const insecureProperty of findInsecureCookieProperties(maskedContent, cookieObjectRange)) {
    pushDiagnostic(
      diagnostics, createDiagnostic(
        options.directory, options.rules, 'astro-doctor/no-insecure-session-cookie', astroConfigProjectPath, `Do not set session.cookie.${insecureProperty.propertyName} to false. Keep Astro's secure session cookie defaults.`, getLocationAtIndex(astroConfigContent, insecureProperty.index)
      )
    )
  }
}

const getActionProjectPaths = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined
): string[] => {
  if (selectedProjectPaths !== undefined) {
    return [...selectedProjectPaths]
      .filter(projectPath => (
        projectPath.startsWith(`${ACTIONS_DIRECTORY_NAME}/`) &&
        /\.(?:[cm]?[jt]s)$/u.test(projectPath) &&
        existsSync(toAbsolutePath(options.directory, projectPath))
      ))
      .sort()
  }

  return globSync(ACTION_FILE_GLOB, {
    cwd: options.directory,
    ignore: buildIgnorePatterns(options.ignore)
  }).sort()
}

const getDefineActionIdentifiers = (actionFileContent: string): string[] => {
  const defineActionIdentifiers: string[] = []

  const defineActionImportPattern =
    /import\s*\{([^}]*)\}\s*from\s*(['"])astro:actions\2/gu

  for (const importMatch of actionFileContent.matchAll(defineActionImportPattern)) {
    const importedNames = importMatch[1] ?? ''

    for (const importedName of importedNames.split(',')) {
      const defineActionImportMatch =
        /^\s*defineAction(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/u.exec(importedName)

      if (defineActionImportMatch !== null) {
        defineActionIdentifiers.push(defineActionImportMatch[1] ?? 'defineAction')
      }
    }
  }

  return defineActionIdentifiers
}

const actionConsumesUncheckedInput = (
  actionFileContent: string,
  maskedContent: string,
  actionObjectRange: ObjectRange
): boolean => {
  if (hasTopLevelProperty(maskedContent, actionObjectRange, 'input')) return false

  const acceptPropertyIndex = findTopLevelPropertyIndex(
    maskedContent, actionObjectRange, 'accept'
  )

  if (
    acceptPropertyIndex !== undefined &&
    /^accept\s*:\s*(['"])form\1/u.test(actionFileContent.slice(acceptPropertyIndex))
  ) {
    return false
  }

  const handlerPropertyIndex = findTopLevelPropertyIndex(
    maskedContent, actionObjectRange, 'handler'
  )

  if (handlerPropertyIndex === undefined) return false

  const handlerContent = actionFileContent.slice(
    handlerPropertyIndex, actionObjectRange.closingIndex
  )

  const handlerInputMatch =
    /^handler\s*:\s*(?:async\s+)?(?:function\s*)?\(\s*([^,\s)]*)/u.exec(handlerContent) ??
    /^handler\s*:\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/u.exec(handlerContent)

  const handlerInput = handlerInputMatch?.[1] ?? ''

  return handlerInput.length > 0 && !handlerInput.startsWith('_')
}

const getActionWithoutInputIndices = (actionFileContent: string): number[] => {
  const maskedContent = maskCodeLiterals(actionFileContent)
  const missingInputIndices: number[] = []
  const defineActionIdentifiers = getDefineActionIdentifiers(actionFileContent)

  if (defineActionIdentifiers.length === 0) return missingInputIndices

  const defineActionPattern = new RegExp(
    `\\b(?:${defineActionIdentifiers.join('|')})\\s*\\(`, 'gu'
  )

  for (const defineActionMatch of maskedContent.matchAll(defineActionPattern)) {
    const callOpeningIndex = defineActionMatch.index + defineActionMatch[0].lastIndexOf('(')
    const objectOpeningIndex = findNextNonWhitespaceIndex(maskedContent, callOpeningIndex + 1)
    const actionObjectRange = findObjectRange(maskedContent, objectOpeningIndex)

    if (
      actionObjectRange !== undefined &&
      actionConsumesUncheckedInput(actionFileContent, maskedContent, actionObjectRange)
    ) {
      missingInputIndices.push(defineActionMatch.index)
    }
  }

  return missingInputIndices
}

const auditActionInputSchemas = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  for (const actionProjectPath of getActionProjectPaths(options, selectedProjectPaths)) {
    const actionFileContent = readProjectFile(options.directory, actionProjectPath)

    if (actionFileContent === undefined) continue

    for (const actionIndex of getActionWithoutInputIndices(actionFileContent)) {
      pushDiagnostic(
        diagnostics, createDiagnostic(
          options.directory, options.rules, 'astro-doctor/require-action-input-schema', actionProjectPath, 'Add an input schema to this action so untrusted input is validated before the handler runs.', getLocationAtIndex(actionFileContent, actionIndex)
        )
      )
    }
  }
}

const getProjectAstroFiles = (options: ProjectAuditOptions): string[] => options.files === undefined ?
  [...options.astroFiles ?? []] :
  globSync(ASTRO_FILE_GLOB, {
    cwd: options.directory,
    absolute: true,
    ignore: buildIgnorePatterns(options.ignore)
  }).sort()

const projectUsesClientRouter = (options: ProjectAuditOptions): boolean => getProjectAstroFiles(options).some(astroFilePath => readFileSync(astroFilePath, 'utf8').includes('<ClientRouter'))

const auditClientRouterScriptLifecycle = (
  options: ProjectAuditOptions,
  diagnostics: Diagnostic[]
): void => {
  if (!projectUsesClientRouter(options)) return

  for (const astroFilePath of options.astroFiles ?? []) {
    const astroFileContent = readFileSync(astroFilePath, 'utf8')
    const scriptPattern = /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/giu

    const domContentLoadedPattern =
      /\b(?:document|window)\s*\.\s*addEventListener\s*\(\s*(['"])DOMContentLoaded\1/u

    for (const scriptMatch of astroFileContent.matchAll(scriptPattern)) {
      const lifecycleEventMatch = domContentLoadedPattern.exec(scriptMatch[0])

      if (lifecycleEventMatch?.index === undefined) continue

      const lifecycleEventIndex = scriptMatch.index +
        lifecycleEventMatch.index +
        lifecycleEventMatch[0].lastIndexOf('DOMContentLoaded')

      const projectPath = toProjectPath(options.directory, astroFilePath)

      pushDiagnostic(
        diagnostics, createDiagnostic(
          options.directory, options.rules, 'astro-doctor/require-client-router-script-lifecycle', projectPath, 'DOMContentLoaded only runs on the initial page load with ClientRouter. Initialize on \'astro:page-load\' instead.', getLocationAtIndex(astroFileContent, lifecycleEventIndex)
        )
      )
    }
  }
}

const getEnvExampleVariableNames = (envExampleContent: string): string[] => envExampleContent
  .split(/\r?\n/u)
  .map(line => line.trim())
  .filter(line => line.length > 0 && !line.startsWith('#'))
  .map(line => line.split('=')[0]?.trim())
  .filter((variableName): variableName is string => Boolean(variableName))

const looksLikeSecret = (
  variableName: string
): boolean => SECRET_ENV_NAME_PARTS.some(secretNamePart => variableName.includes(secretNamePart))

const auditEnvExample = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  if (!isSelected(selectedProjectPaths, ENV_EXAMPLE_FILE_NAME)) return

  const envExampleContent = readProjectFile(options.directory, ENV_EXAMPLE_FILE_NAME)

  if (envExampleContent === undefined) return

  const variableNames = getEnvExampleVariableNames(envExampleContent)

  for (const variableName of variableNames) {
    if (!variableName.startsWith(PUBLIC_ENV_PREFIX) || !looksLikeSecret(variableName)) continue

    pushDiagnostic(
      diagnostics, createDiagnostic(
        options.directory, options.rules, 'astro-doctor/no-public-secret-env', ENV_EXAMPLE_FILE_NAME, `${variableName} is declared as public but looks like a secret. PUBLIC_ variables are exposed to client-side code.`, getLocation(envExampleContent, variableName)
      )
    )
  }
}

const auditEnvSchema = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  const astroConfigProjectPath = findExistingProjectFile(options.directory, ASTRO_CONFIG_FILE_NAMES)

  if (
    !isSelected(selectedProjectPaths, ENV_EXAMPLE_FILE_NAME) &&
    (astroConfigProjectPath === undefined || !isSelected(selectedProjectPaths, astroConfigProjectPath))
  ) {
    return
  }

  const envExampleContent = readProjectFile(options.directory, ENV_EXAMPLE_FILE_NAME)

  if (envExampleContent === undefined || getEnvExampleVariableNames(envExampleContent).length === 0) {
    return
  }

  if (astroConfigProjectPath === undefined) {
    pushDiagnostic(
      diagnostics, createDiagnostic(
        options.directory, options.rules, 'astro-doctor/prefer-env-schema', ENV_EXAMPLE_FILE_NAME, 'Define an Astro env schema for documented environment variables so they are typed and validated.'
      )
    )

    return
  }

  const astroConfigContent = readProjectFile(options.directory, astroConfigProjectPath)

  if (astroConfigContent?.includes('envField') && /env\s*:\s*\{/u.test(astroConfigContent)) return

  pushDiagnostic(
    diagnostics, createDiagnostic(
      options.directory, options.rules, 'astro-doctor/prefer-env-schema', ENV_EXAMPLE_FILE_NAME, 'Define an Astro env schema for documented environment variables so they are typed and validated.'
    )
  )
}

const hasContentEntries = (rootDirectory: string): boolean => {
  const contentDirectory = toAbsolutePath(rootDirectory, CONTENT_DIRECTORY_NAME)

  return existsSync(contentDirectory) &&
    statSync(contentDirectory).isDirectory() &&
    readdirSync(contentDirectory).some(entryName => !entryName.startsWith('.'))
}

const auditContentConfig = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[]
): void => {
  if (!isSelectedByPrefix(selectedProjectPaths, `${CONTENT_DIRECTORY_NAME}/`)) return

  if (!hasContentEntries(options.directory)) return

  const contentConfigProjectPath = findExistingProjectFile(options.directory, CONTENT_CONFIG_FILE_NAMES)

  if (contentConfigProjectPath !== undefined) return

  pushDiagnostic(
    diagnostics, createDiagnostic(
      options.directory, options.rules, 'astro-doctor/require-content-config', CONTENT_DIRECTORY_NAME, 'Add a content config with defineCollection() so content entries are typed and validated.'
    )
  )
}

export const auditProject = (options: ProjectAuditOptions): Diagnostic[] => {
  const selectedProjectPaths = getSelectedProjectPaths(options.directory, options.files)
  const diagnostics: Diagnostic[] = []

  auditPackageManager(options, selectedProjectPaths, diagnostics)

  auditAstroSecurityConfig(options, selectedProjectPaths, diagnostics)

  auditAstro7ExperimentalFlags(options, selectedProjectPaths, diagnostics)

  auditFetchEntrypoint(options, selectedProjectPaths, diagnostics)

  auditSessionCookie(options, selectedProjectPaths, diagnostics)

  auditActionInputSchemas(options, selectedProjectPaths, diagnostics)

  auditClientRouterScriptLifecycle(options, diagnostics)

  auditEnvExample(options, selectedProjectPaths, diagnostics)

  auditEnvSchema(options, selectedProjectPaths, diagnostics)

  auditContentConfig(options, selectedProjectPaths, diagnostics)

  return diagnostics
}
