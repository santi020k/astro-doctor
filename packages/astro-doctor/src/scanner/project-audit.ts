import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

import {
  DEFAULT_DIAGNOSTIC_COLUMN_NUMBER,
  DEFAULT_DIAGNOSTIC_LINE_NUMBER,
} from '../constants.js'
import { getProjectRuleMeta } from '../project-rules.js'
import type { Diagnostic, ScanOptions, Severity } from '../types.js'

const ASTRO_CONFIG_FILE_NAMES = [
  'astro.config.ts',
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.cjs',
  'astro.config.mts',
  'astro.config.cts',
]

const CONTENT_CONFIG_FILE_NAMES = [
  'src/content.config.ts',
  'src/content.config.mjs',
  'src/content.config.js',
  'src/content/config.ts',
  'src/content/config.mjs',
  'src/content/config.js',
]

const PACKAGE_FILE_NAME = 'package.json'
const PACKAGE_LOCK_FILE_NAME = 'package-lock.json'
const YARN_LOCK_FILE_NAME = 'yarn.lock'
const ENV_EXAMPLE_FILE_NAME = '.env.example'
const CONTENT_DIRECTORY_NAME = 'src/content'
const PUBLIC_ENV_PREFIX = 'PUBLIC_'
const SECRET_ENV_NAME_PARTS = ['TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE', 'KEY']

const PROJECT_AUDIT_FILE_NAMES = [
  ...ASTRO_CONFIG_FILE_NAMES,
  ...CONTENT_CONFIG_FILE_NAMES,
  PACKAGE_FILE_NAME,
  PACKAGE_LOCK_FILE_NAME,
  YARN_LOCK_FILE_NAME,
  ENV_EXAMPLE_FILE_NAME,
]

interface Location {
  readonly line: number
  readonly column: number
}

interface ProjectAuditOptions {
  readonly directory: string
  readonly files?: readonly string[]
  readonly rules?: ScanOptions['rules']
}

const toProjectPath = (rootDirectory: string, filePath: string): string =>
  (isAbsolute(filePath) ? relative(rootDirectory, filePath) : filePath).replaceAll('\\', '/')

export const isProjectAuditRelevantPath = (filePath: string): boolean => {
  const normalizedFilePath = filePath.replaceAll('\\', '/')

  return PROJECT_AUDIT_FILE_NAMES.some(
    (projectPath) =>
      normalizedFilePath === projectPath || normalizedFilePath.endsWith(`/${projectPath}`),
  ) || normalizedFilePath.startsWith(`${CONTENT_DIRECTORY_NAME}/`) ||
    normalizedFilePath.includes(`/${CONTENT_DIRECTORY_NAME}/`)
}

const toAbsolutePath = (rootDirectory: string, projectPath: string): string =>
  resolve(rootDirectory, projectPath)

const getSelectedProjectPaths = (
  rootDirectory: string,
  filePaths: readonly string[] | undefined,
): Set<string> | undefined =>
  filePaths === undefined
    ? undefined
    : new Set(filePaths.map((filePath) => toProjectPath(rootDirectory, filePath)))

const isSelected = (
  selectedProjectPaths: Set<string> | undefined,
  projectPath: string,
): boolean => selectedProjectPaths === undefined || selectedProjectPaths.has(projectPath)

const isSelectedByPrefix = (
  selectedProjectPaths: Set<string> | undefined,
  projectPathPrefix: string,
): boolean =>
  selectedProjectPaths === undefined ||
  [...selectedProjectPaths].some((projectPath) => projectPath.startsWith(projectPathPrefix))

const findExistingProjectFile = (
  rootDirectory: string,
  projectPaths: readonly string[],
): string | undefined =>
  projectPaths.find((projectPath) => existsSync(toAbsolutePath(rootDirectory, projectPath)))

const readProjectFile = (rootDirectory: string, projectPath: string): string | undefined => {
  const filePath = toAbsolutePath(rootDirectory, projectPath)

  if (!existsSync(filePath)) return undefined

  return readFileSync(filePath, 'utf8')
}

const getLocation = (content: string, searchText: string): Location => {
  const matchIndex = content.indexOf(searchText)

  if (matchIndex === -1) {
    return {
      line: DEFAULT_DIAGNOSTIC_LINE_NUMBER,
      column: DEFAULT_DIAGNOSTIC_COLUMN_NUMBER,
    }
  }

  const contentBeforeMatch = content.slice(0, matchIndex)
  const lines = contentBeforeMatch.split(/\r?\n/u)
  const lastLine = lines.at(-1) ?? ''

  return {
    line: lines.length,
    column: lastLine.length + DEFAULT_DIAGNOSTIC_COLUMN_NUMBER,
  }
}

const getEffectiveSeverity = (
  ruleId: string,
  rules: ScanOptions['rules'],
): Severity | undefined => {
  const ruleOverride = rules?.[ruleId]

  if (ruleOverride === 'off') return undefined

  if (ruleOverride === 'error') return 'error'

  if (ruleOverride === 'warn') return 'warning'

  return getProjectRuleMeta(ruleId)?.severity
}

const createDiagnostic = (
  rootDirectory: string,
  rules: ScanOptions['rules'],
  ruleId: string,
  projectPath: string,
  message: string,
  location: Location = {
    line: DEFAULT_DIAGNOSTIC_LINE_NUMBER,
    column: DEFAULT_DIAGNOSTIC_COLUMN_NUMBER,
  },
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
    category: projectRuleMeta.category,
  }
}

const pushDiagnostic = (
  diagnostics: Diagnostic[],
  diagnostic: Diagnostic | undefined,
): void => {
  if (diagnostic !== undefined) diagnostics.push(diagnostic)
}

const auditPackageManager = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[],
): void => {
  if (
    !isSelected(selectedProjectPaths, PACKAGE_FILE_NAME) &&
    !isSelected(selectedProjectPaths, PACKAGE_LOCK_FILE_NAME) &&
    !isSelected(selectedProjectPaths, YARN_LOCK_FILE_NAME)
  ) {
    return
  }

  const packageJsonContent = readProjectFile(options.directory, PACKAGE_FILE_NAME)

  if (packageJsonContent === undefined) return

  const packageLockExists = existsSync(toAbsolutePath(options.directory, PACKAGE_LOCK_FILE_NAME))
  const yarnLockExists = existsSync(toAbsolutePath(options.directory, YARN_LOCK_FILE_NAME))

  const usesPnpm = packageJsonContent.includes('"packageManager"') &&
    packageJsonContent.includes('"pnpm@')

  if (usesPnpm && !packageLockExists && !yarnLockExists) return

  pushDiagnostic(
    diagnostics,
    createDiagnostic(
      options.directory,
      options.rules,
      'astro-doctor/prefer-pnpm',
      PACKAGE_FILE_NAME,
      'Use pnpm consistently: set packageManager to pnpm and remove npm/yarn lockfiles.',
      getLocation(packageJsonContent, '"packageManager"'),
    ),
  )
}

const auditAstroSecurityConfig = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[],
): void => {
  const astroConfigProjectPath = findExistingProjectFile(options.directory, ASTRO_CONFIG_FILE_NAMES)

  if (astroConfigProjectPath === undefined || !isSelected(selectedProjectPaths, astroConfigProjectPath)) {
    return
  }

  const astroConfigContent = readProjectFile(options.directory, astroConfigProjectPath)

  if (astroConfigContent === undefined) return

  if (/checkOrigin\s*:\s*false/u.test(astroConfigContent)) {
    pushDiagnostic(
      diagnostics,
      createDiagnostic(
        options.directory,
        options.rules,
        'astro-doctor/no-disabled-origin-check',
        astroConfigProjectPath,
        'Do not disable Astro security.checkOrigin unless you have a specific CSRF mitigation in place.',
        getLocation(astroConfigContent, 'checkOrigin'),
      ),
    )
  }

  if (/allowedDomains\s*:\s*\[\s*\{\s*\}\s*\]/u.test(astroConfigContent)) {
    pushDiagnostic(
      diagnostics,
      createDiagnostic(
        options.directory,
        options.rules,
        'astro-doctor/no-open-allowed-domains',
        astroConfigProjectPath,
        'Avoid security.allowedDomains: [{}]. Configure explicit trusted host patterns instead.',
        getLocation(astroConfigContent, 'allowedDomains'),
      ),
    )
  }
}

const getEnvExampleVariableNames = (envExampleContent: string): string[] =>
  envExampleContent
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split('=')[0]?.trim())
    .filter((variableName): variableName is string => Boolean(variableName))

const looksLikeSecret = (variableName: string): boolean =>
  SECRET_ENV_NAME_PARTS.some((secretNamePart) => variableName.includes(secretNamePart))

const auditEnvExample = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[],
): void => {
  if (!isSelected(selectedProjectPaths, ENV_EXAMPLE_FILE_NAME)) return

  const envExampleContent = readProjectFile(options.directory, ENV_EXAMPLE_FILE_NAME)

  if (envExampleContent === undefined) return

  const variableNames = getEnvExampleVariableNames(envExampleContent)

  for (const variableName of variableNames) {
    if (!variableName.startsWith(PUBLIC_ENV_PREFIX) || !looksLikeSecret(variableName)) continue

    pushDiagnostic(
      diagnostics,
      createDiagnostic(
        options.directory,
        options.rules,
        'astro-doctor/no-public-secret-env',
        ENV_EXAMPLE_FILE_NAME,
        `${variableName} is declared as public but looks like a secret. PUBLIC_ variables are exposed to client-side code.`,
        getLocation(envExampleContent, variableName),
      ),
    )
  }
}

const auditEnvSchema = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[],
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
      diagnostics,
      createDiagnostic(
        options.directory,
        options.rules,
        'astro-doctor/prefer-env-schema',
        ENV_EXAMPLE_FILE_NAME,
        'Define an Astro env schema for documented environment variables so they are typed and validated.',
      ),
    )

    return
  }

  const astroConfigContent = readProjectFile(options.directory, astroConfigProjectPath)

  if (astroConfigContent?.includes('envField') && /env\s*:\s*\{/u.test(astroConfigContent)) return

  pushDiagnostic(
    diagnostics,
    createDiagnostic(
      options.directory,
      options.rules,
      'astro-doctor/prefer-env-schema',
      ENV_EXAMPLE_FILE_NAME,
      'Define an Astro env schema for documented environment variables so they are typed and validated.',
    ),
  )
}

const hasContentEntries = (rootDirectory: string): boolean => {
  const contentDirectory = toAbsolutePath(rootDirectory, CONTENT_DIRECTORY_NAME)

  if (!existsSync(contentDirectory) || !statSync(contentDirectory).isDirectory()) return false

  return readdirSync(contentDirectory).some((entryName) => !entryName.startsWith('.'))
}

const auditContentConfig = (
  options: ProjectAuditOptions,
  selectedProjectPaths: Set<string> | undefined,
  diagnostics: Diagnostic[],
): void => {
  if (!isSelectedByPrefix(selectedProjectPaths, `${CONTENT_DIRECTORY_NAME}/`)) return

  if (!hasContentEntries(options.directory)) return

  const contentConfigProjectPath = findExistingProjectFile(options.directory, CONTENT_CONFIG_FILE_NAMES)

  if (contentConfigProjectPath !== undefined) return

  pushDiagnostic(
    diagnostics,
    createDiagnostic(
      options.directory,
      options.rules,
      'astro-doctor/require-content-config',
      CONTENT_DIRECTORY_NAME,
      'Add a content config with defineCollection() so content entries are typed and validated.',
    ),
  )
}

export const auditProject = (options: ProjectAuditOptions): Diagnostic[] => {
  const selectedProjectPaths = getSelectedProjectPaths(options.directory, options.files)
  const diagnostics: Diagnostic[] = []

  auditPackageManager(options, selectedProjectPaths, diagnostics)

  auditAstroSecurityConfig(options, selectedProjectPaths, diagnostics)

  auditEnvExample(options, selectedProjectPaths, diagnostics)

  auditEnvSchema(options, selectedProjectPaths, diagnostics)

  auditContentConfig(options, selectedProjectPaths, diagnostics)

  return diagnostics
}
