import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import type { RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'

import { formatConsoleReport, formatProjectScoreTable, formatScoreOnly } from './report/console.js'
import { formatGithubReport } from './report/github.js'
import { formatJsonReport, serializeJsonReport } from './report/json.js'
import { formatSarifReport, serializeSarifReport } from './report/sarif.js'
import { scan } from './scanner/index.js'
import { isProjectAuditRelevantPath } from './scanner/project-audit.js'
import { getPackageVersion } from './utils/get-package-version.js'
import { isFileInDirectory } from './utils/is-file-in-directory.js'
import {
  createPersistentBaseline,
  filterIntroducedDiagnostics,
  filterPersistentBaselineDiagnostics,
  readPersistentBaseline,
  scanBaseline,
  writePersistentBaseline,
} from './baseline.js'
import { loadConfig } from './config.js'
import {
  DEFAULT_BASELINE_FILE_NAME,
  DISABLED_THRESHOLD_SCORE,
  MAXIMUM_THRESHOLD_SCORE,
  MINIMUM_THRESHOLD_SCORE,
} from './constants.js'
import { getDiffAstroFiles,getStagedAstroFiles, resolveBaseRevision } from './git.js'
import { runInit } from './init.js'
import { runInstall } from './install.js'
import { runLsp } from './lsp.js'
import {
  aggregateResults,
  autoDiscoverAstroProjects,
  mergeConfigs,
  scanProjects,
} from './multi-project.js'
import type { PresetName } from './presets.js'
import {
  getPresetFailOn,
  getPresetRules,
  getPresetThreshold,
  isPresetName,
} from './presets.js'
import { runRulesExplain } from './rules-explain.js'
import { trackRun } from './telemetry.js'
import type { AstroDoctorConfig, ProjectScanResult, ScanOptions, ScanResult } from './types.js'
import { runWhy } from './why.js'

type OutputFormat = 'console' | 'github' | 'sarif'

type ScanScope = 'full' | 'files' | 'changed'

interface CliOptions {
  readonly directory: string
  readonly help: boolean
  readonly version: boolean
  readonly json: string | boolean
  readonly jsonCompact: boolean
  readonly noScore: boolean
  readonly scoreOnly: boolean
  readonly quiet: boolean
  readonly verbose: boolean
  readonly preset?: PresetName
  readonly failOn: 'error' | 'warning' | 'off'
  readonly failOnProvided: boolean
  readonly format: OutputFormat
  readonly threshold: number
  readonly thresholdProvided: boolean
  readonly changedFilesFrom?: string
  readonly staged: boolean
  readonly diff: string | boolean
  readonly scope: ScanScope
  readonly base?: string
  readonly categories: readonly RuleCategory[]
  readonly fix: boolean
  readonly noLint: boolean
  readonly noRespectInlineDisables: boolean
  readonly projects: readonly string[]
  readonly noTelemetry: boolean
  readonly baseline?: string
  readonly cache: boolean
}

const VALID_CATEGORIES: RuleCategory[] = [
  'performance',
  'accessibility',
  'security',
  'best-practices',
]

const BOOLEAN_OPTIONS = new Set([
  '--fix',
  '--help',
  '-h',
  '--json-compact',
  '--no-lint',
  '--no-respect-inline-disables',
  '--no-score',
  '--no-telemetry',
  '--quiet',
  '--score',
  '--staged',
  '--verbose',
  '--version',
  '-v',
  '--cache',
])

const VALUE_OPTIONS = new Set([
  '--base',
  '--baseline',
  '--blocking',
  '--category',
  '--changed-files-from',
  '--dir',
  '-d',
  '--fail-on',
  '--format',
  '--preset',
  '--project',
  '--scope',
  '--threshold',
])

const OPTIONAL_VALUE_OPTIONS = new Set(['--diff', '--json'])

const validateBooleanArgument = (
  argument: string,
  optionName: string,
): boolean => {
  if (!BOOLEAN_OPTIONS.has(optionName)) return false

  if (argument.includes('=')) {
    throw new Error(`Option "${optionName}" does not accept a value.`)
  }

  return true
}

const validateValueArgument = (
  argv: readonly string[],
  argumentIndex: number,
  argument: string,
  optionName: string,
): number | undefined => {
  if (!VALUE_OPTIONS.has(optionName)) return undefined

  if (argument.includes('=')) {
    if (argument.slice(argument.indexOf('=') + 1).length === 0) {
      throw new Error(`Option "${optionName}" requires a value.`)
    }

    return argumentIndex
  }

  const optionValue = argv[argumentIndex + 1]

  if (optionValue === undefined || optionValue.startsWith('-')) {
    throw new Error(`Option "${optionName}" requires a value.`)
  }

  return argumentIndex + 1
}

const validateOptionalValueArgument = (
  argv: readonly string[],
  argumentIndex: number,
  argument: string,
  optionName: string,
): number | undefined => {
  if (!OPTIONAL_VALUE_OPTIONS.has(optionName)) return undefined

  const optionValue = argv[argumentIndex + 1]

  if (!argument.includes('=') && optionValue !== undefined && !optionValue.startsWith('-')) {
    return argumentIndex + 1
  }

  return argumentIndex
}

const validateArguments = (argv: readonly string[]): void => {
  for (let argumentIndex = 0; argumentIndex < argv.length; argumentIndex++) {
    const argument = argv[argumentIndex]

    if (argument === undefined) continue

    const optionName = argument.split('=', 1)[0] ?? argument

    if (validateBooleanArgument(argument, optionName)) continue

    const validatedValueIndex = validateValueArgument(
      argv,
      argumentIndex,
      argument,
      optionName,
    )

    if (validatedValueIndex !== undefined) {
      argumentIndex = validatedValueIndex

      continue
    }

    const validatedOptionalIndex = validateOptionalValueArgument(
      argv,
      argumentIndex,
      argument,
      optionName,
    )

    if (validatedOptionalIndex !== undefined) {
      argumentIndex = validatedOptionalIndex

      continue
    }

    throw new Error(`Unknown option "${argument}". Run astro-doctor --help for usage.`)
  }
}

const validateSimpleArguments = (
  argv: readonly string[],
  booleanOptions: ReadonlySet<string>,
  valueOptions: ReadonlySet<string>,
): void => {
  for (let argumentIndex = 0; argumentIndex < argv.length; argumentIndex++) {
    const argument = argv[argumentIndex]

    if (argument === undefined) continue

    const optionName = argument.split('=', 1)[0] ?? argument

    if (booleanOptions.has(optionName)) {
      if (argument.includes('=')) {
        throw new Error(`Option "${optionName}" does not accept a value.`)
      }

      continue
    }

    if (!valueOptions.has(optionName)) {
      throw new Error(`Unknown option "${argument}".`)
    }

    const validatedIndex = validateValueArgument(argv, argumentIndex, argument, optionName)

    if (validatedIndex === undefined) {
      throw new Error(`Option "${optionName}" requires a value.`)
    }

    argumentIndex = validatedIndex
  }
}

const getOptionValue = (
  argv: readonly string[],
  optionName: string,
  alias?: string,
): string | undefined => {
  const inlinePrefix = `${optionName}=`
  const inlineArgument = argv.find((argument) => argument.startsWith(inlinePrefix))

  if (inlineArgument) return inlineArgument.slice(inlinePrefix.length)

  const optionIndex = argv.findIndex(
    (argument) => argument === optionName || (alias !== undefined && argument === alias),
  )

  if (optionIndex === -1) return undefined

  const optionValue = argv[optionIndex + 1]

  return optionValue?.startsWith('-') ? undefined : optionValue
}

const getAllOptionValues = (argv: readonly string[], optionName: string): string[] => {
  const values: string[] = []

  for (const [i, arg] of argv.entries()) {
    const inlinePrefix = `${optionName}=`

    if (arg.startsWith(inlinePrefix)) {
      values.push(arg.slice(inlinePrefix.length))
    } else {
      const nextArg = argv[i + 1]

      if (arg === optionName && nextArg !== undefined && !nextArg.startsWith('-')) {
        values.push(nextArg)
      }
    }
  }

  return values
}

const getJsonOption = (argv: readonly string[]): CliOptions['json'] => {
  const jsonValue = getOptionValue(argv, '--json')

  if (jsonValue !== undefined) return jsonValue

  if (argv.includes('--json')) return true

  return false
}

const getDiffOption = (argv: readonly string[]): CliOptions['diff'] => {
  const diffValue = getOptionValue(argv, '--diff')

  if (diffValue === 'false') return false

  if (diffValue !== undefined) return diffValue

  if (argv.includes('--diff')) return true

  return false
}

const parseScope = (argv: readonly string[]): ScanScope => {
  const scope = getOptionValue(argv, '--scope')

  if (scope === undefined) {
    const hasPartialFileSelection = getDiffOption(argv) !== false ||
      argv.includes('--staged') ||
      getOptionValue(argv, '--changed-files-from') !== undefined

    return hasPartialFileSelection ? 'files' : 'full'
  }

  if (scope === 'full' || scope === 'files' || scope === 'changed') return scope

  throw new Error(`Unknown scope "${scope}". Valid values: full, files, changed.`)
}

const readChangedFiles = (filePath: string): string[] =>
  readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((changedFilePath) => changedFilePath.trim())
    .filter(Boolean)

const parseCategories = (argv: readonly string[]): RuleCategory[] => {
  const values = getAllOptionValues(argv, '--category')
  const valid: RuleCategory[] = []

  for (const value of values) {
    if (VALID_CATEGORIES.includes(value as RuleCategory)) {
      valid.push(value as RuleCategory)
    } else {
      throw new Error(`Unknown category "${value}". Valid values: ${VALID_CATEGORIES.join(', ')}.`)
    }
  }

  return valid
}

const parsePreset = (argv: readonly string[]): PresetName | undefined => {
  const presetValue = getOptionValue(argv, '--preset')

  if (presetValue === undefined) return undefined

  if (isPresetName(presetValue)) return presetValue

  throw new Error(`Unknown preset "${presetValue}". Valid values: recommended, strict, ci, all.`)
}

const getProjectsOption = (argv: readonly string[]): string[] => {
  const raw = getOptionValue(argv, '--project')

  if (!raw) return []

  // Support both comma-separated and repeated flags
  const fromComma = raw.split(',').map((s) => s.trim()).filter(Boolean)

  const fromRepeat = getAllOptionValues(argv, '--project')
    .flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean))

  return [...new Set([...fromComma, ...fromRepeat])]
}

const parseFailOn = (argv: readonly string[]): CliOptions['failOn'] => {
  const value = getOptionValue(argv, '--fail-on') ?? getOptionValue(argv, '--blocking')

  if (value === undefined || value === 'error') return 'error'

  if (value === 'warning' || value === 'off') return value

  throw new Error(`Unknown fail-on level "${value}". Valid values: error, warning, off.`)
}

const parseFormat = (argv: readonly string[]): OutputFormat => {
  const value = getOptionValue(argv, '--format')

  if (value === undefined || value === 'console') return 'console'

  if (value === 'github' || value === 'sarif') return value

  throw new Error(`Unknown format "${value}". Valid values: console, github, sarif.`)
}

const parseThreshold = (argv: readonly string[]): number => {
  const value = getOptionValue(argv, '--threshold')

  if (value === undefined) return DISABLED_THRESHOLD_SCORE

  if (!/^\d+$/u.test(value)) {
    throw new Error(`Invalid threshold "${value}". Expected an integer from 0 to 100.`)
  }

  const parsed = Number.parseInt(value, 10)

  if (parsed < MINIMUM_THRESHOLD_SCORE || parsed > MAXIMUM_THRESHOLD_SCORE) {
    throw new Error(`Invalid threshold "${value}". Expected an integer from 0 to 100.`)
  }

  return parsed
}

const parseArguments = (argv: string[]): CliOptions => {
  validateArguments(argv)

  const directoryArg = getOptionValue(argv, '--dir', '-d')
  const directory = directoryArg ? resolve(directoryArg) : process.cwd()
  const failOnValue = getOptionValue(argv, '--fail-on') ?? getOptionValue(argv, '--blocking')
  const thresholdValue = getOptionValue(argv, '--threshold')

  return {
    directory,
    help: argv.includes('--help') || argv.includes('-h'),
    version: argv.includes('--version') || argv.includes('-v'),
    json: getJsonOption(argv),
    jsonCompact: argv.includes('--json-compact'),
    noScore: argv.includes('--no-score'),
    scoreOnly: argv.includes('--score'),
    quiet: argv.includes('--quiet'),
    verbose: argv.includes('--verbose'),
    preset: parsePreset(argv),
    failOn: parseFailOn(argv),
    failOnProvided: failOnValue !== undefined,
    format: parseFormat(argv),
    threshold: parseThreshold(argv),
    thresholdProvided: thresholdValue !== undefined,
    changedFilesFrom: getOptionValue(argv, '--changed-files-from'),
    staged: argv.includes('--staged'),
    diff: getDiffOption(argv),
    scope: parseScope(argv),
    base: getOptionValue(argv, '--base'),
    categories: parseCategories(argv),
    fix: argv.includes('--fix'),
    noLint: argv.includes('--no-lint'),
    noRespectInlineDisables: argv.includes('--no-respect-inline-disables'),
    projects: getProjectsOption(argv),
    noTelemetry: argv.includes('--no-telemetry') || process.env.ASTRO_DOCTOR_NO_TELEMETRY === '1',
    baseline: getOptionValue(argv, '--baseline'),
    cache: argv.includes('--cache'),
  }
}

const printHelp = (): void => {
  console.log(`
astro-doctor — Your agent writes bad Astro. This catches it.

Usage:
  astro-doctor [command] [options]

Commands:
  (no command)             Scan the current directory
  init                     Create starter config, ESLint config, and GitHub Action
  install                  Set up GitHub Actions, agent skills, and hooks
  why <file>:<line>        Explain the issue at a specific file location
  rules                    List all rules
  rules explain <rule-id>  Explain a rule in detail
  baseline create          Save current findings as a persistent baseline
  baseline update          Replace an existing persistent baseline
  experimental-lsp         Start the experimental language server (--stdio)

Scan options:
  -d, --dir <path>                  Directory to scan (default: cwd)
      --project <name|path>         Scan a specific workspace project by package name or relative
                                    path (repeat or comma-separate for multiple projects)
      --diff [base]                 Scan files changed vs. a base branch (default: main/master)
      --scope <scope>               full | files | changed (introduced diagnostics only)
      --base <ref>                  Base revision for files or changed scope
      --staged                      Scan only git-staged Astro Doctor files (pre-commit)
      --changed-files-from <path>   Scan newline-separated changed files from a file
      --category <cat>              Filter to one category (repeat for multiple)
                                    Categories: performance | accessibility | security | best-practices
      --preset <name>               recommended (default) | strict | ci | all
      --fix                         Apply safe automatic fixes
      --cache                       Cache lint results by file content
      --baseline <path>             Suppress findings stored in a persistent baseline
      --no-lint                     Skip lint; report a clean result
      --no-respect-inline-disables  Audit mode: ignore eslint-disable comments

Output options:
      --score                       Print only the numeric health score (0–100)
      --no-score                    Omit the health score from the report
      --verbose                     Show per-rule summary alongside findings
      --json [path]                 Output a JSON report (stdout or a file)
      --json-compact                Compact single-line JSON (use with --json)
      --format <fmt>                console (default) | github | sarif
      --quiet                       Show errors only; suppress warnings from output

Exit / threshold options:
      --fail-on <level>             Exit 1 on severity: error | warning | off (default: error)
      --blocking <level>            Alias for --fail-on
      --threshold <score>           Exit 1 when health score is below this (0–100)

Other:
      --no-telemetry                Opt out of anonymous usage telemetry
                                    (also: ASTRO_DOCTOR_NO_TELEMETRY=1)
  -v, --version                     Print the installed version
  -h, --help                        Show this help message

Install options:
  init [--preset recommended|strict|ci|all]

  install [-y] [--dry-run] [--agent-hooks]
    -y, --yes      Skip all prompts
    --dry-run      Preview what would be installed without writing files
    --agent-hooks  Install native Claude Code and Cursor hooks

Configuration:
  Add a doctor.config.ts (or .js, .mjs, .cjs, .json, .jsonc) to your project root.
  Supports: preset, rules, overrides, ignore, projects, failOn, threshold

Rules checked:
  Performance:    no-blocking-script, no-client-load-overuse, no-unprocessed-script-surprises,
                  require-image-dimensions, use-astro-image
  Accessibility:  no-missing-alt, no-missing-lang, require-island-fallback
  Security:       no-insecure-session-cookie, no-public-secret-env, no-set-html,
                  require-action-input-schema
  Best Practices: no-process-env, prefer-class-list, prefer-content-collections
  Strict audits:  require-client-router-script-lifecycle
  `)
}

const handleJsonOutput = (
  scanResult: ScanResult,
  options: CliOptions,
  projects?: readonly ProjectScanResult[],
): boolean => {
  const report = formatJsonReport(scanResult, options.directory, projects, options.scope)
  const reportJson = serializeJsonReport(report, options.jsonCompact)

  if (typeof options.json === 'string') {
    writeFileSync(options.json, reportJson, 'utf8')

    console.log(`JSON report written to ${options.json}`)

    return false
  }

  console.log(reportJson)

  return true
}

const printReport = (
  scanResult: ScanResult,
  options: CliOptions,
  projects?: readonly ProjectScanResult[],
): boolean => {
  if (options.scoreOnly) {
    console.log(formatScoreOnly(scanResult))

    return true
  }

  if (options.json !== false) {
    if (handleJsonOutput(scanResult, options, projects)) return true
  } else if (options.format === 'github') {
    const githubOutput = formatGithubReport(scanResult)

    if (githubOutput) console.log(githubOutput)
  } else if (options.format === 'sarif') {
    console.log(serializeSarifReport(
      formatSarifReport(scanResult, options.directory),
      options.jsonCompact,
    ))
  } else {
    const displayResult =
      options.quiet
        ? { ...scanResult, diagnostics: scanResult.diagnostics.filter((d) => d.severity === 'error') }
        : scanResult

    const report = formatConsoleReport(displayResult, options.directory, !options.noScore, options.verbose)

    console.log(report)

    if (projects && projects.length > 0) {
      console.log(formatProjectScoreTable(projects, scanResult, !options.noScore))
    }
  }

  return false
}

const checkThresholds = (
  scanResult: ScanResult,
  effectiveFailOn: string,
  effectiveThreshold: number,
): void => {
  const shouldFailOnSeverity =
    (effectiveFailOn === 'error' && scanResult.errorCount > 0) ||
    (effectiveFailOn === 'warning' && (scanResult.errorCount > 0 || scanResult.warningCount > 0))

  const shouldFailOnThreshold = effectiveThreshold !== -1 && scanResult.score < effectiveThreshold

  if (shouldFailOnSeverity || shouldFailOnThreshold) {
    if (shouldFailOnThreshold && !shouldFailOnSeverity) {
      console.error(`\nScore ${scanResult.score}/100 is below threshold of ${effectiveThreshold}. Failing.`)
    }

    process.exitCode = 1
  }
}

const getEffectivePreset = (options: CliOptions, config: AstroDoctorConfig | null): PresetName =>
  options.preset ?? config?.preset ?? 'recommended'

const getEffectiveFailOn = (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  preset: PresetName,
): CliOptions['failOn'] => {
  if (options.failOnProvided) return options.failOn

  return config?.failOn ?? getPresetFailOn(preset)
}

const getEffectiveThreshold = (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  preset: PresetName,
): number => {
  if (options.thresholdProvided) return options.threshold

  return config?.threshold ?? getPresetThreshold(preset)
}

const getEffectiveRules = (
  config: AstroDoctorConfig | null,
  preset: PresetName | undefined,
): Record<string, 'error' | 'warn' | 'off'> => ({
  ...getPresetRules(preset ?? 'recommended'),
  ...config?.rules,
})

const isScanRelevantPath = (filePath: string): boolean =>
  filePath.endsWith('.astro') || isProjectAuditRelevantPath(filePath)

const getBaseOption = (options: CliOptions): string | undefined =>
  options.base ?? (typeof options.diff === 'string' ? options.diff : undefined)

const resolveFilesToScan = (options: CliOptions): string[] | undefined => {
  if (options.staged) {
    const files = getStagedAstroFiles(options.directory)

    if (files.length === 0) {
      console.log('No staged Astro Doctor files found — nothing to scan.\n')
    }

    return files
  }

  if (options.changedFilesFrom) {
    return readChangedFiles(options.changedFilesFrom)
  }

  if (options.scope !== 'full' || options.diff !== false) {
    const files = getDiffAstroFiles(options.directory, getBaseOption(options))

    if (files.length === 0) {
      console.log('No changed Astro Doctor files found in diff — nothing to scan.\n')
    }

    return files
  }

  return undefined
}

const resolveEffectiveProjects = (options: CliOptions, config: AstroDoctorConfig | null): string[] => {
  if (options.projects.length > 0) return [...options.projects]

  if (config?.projects && config.projects.length > 0) return [...config.projects]

  return []
}

const tryResolveFilesToScan = (options: CliOptions): { files: string[] | undefined; failed: boolean } => {
  try {
    return { files: resolveFilesToScan(options), failed: false }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`\nFailed to resolve files: ${message}`)

    process.exitCode = 1

    return { files: undefined, failed: true }
  }
}

const hasOnlyIrrelevantChangedFiles = (files: string[] | undefined): boolean =>
  files !== undefined && files.length > 0 && !files.some(isScanRelevantPath)

const shouldPrintProgress = (options: CliOptions): boolean =>
  options.json !== true &&
  options.format === 'console' &&
  !options.scoreOnly

const shouldSkipIrrelevantFiles = (
  options: CliOptions,
  files: string[] | undefined,
): boolean => {
  if (!hasOnlyIrrelevantChangedFiles(files)) return false

  if (options.json !== true) {
    console.log('No Astro Doctor files found in the changed files list — nothing to scan.\n')
  }

  return true
}

const tryScan = async (scanOptions: ScanOptions): Promise<ScanResult | null> => {
  try {
    return await scan(scanOptions)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`\nFailed to scan: ${message}`)

    process.exitCode = 1

    return null
  }
}

const applyPersistentBaseline = (
  result: ScanResult,
  options: CliOptions,
): ScanResult => {
  if (options.baseline === undefined) return result

  const baselinePath = isAbsolute(options.baseline)
    ? options.baseline
    : resolve(options.directory, options.baseline)

  const baseline = readPersistentBaseline(baselinePath)

  return filterPersistentBaselineDiagnostics(result, baseline, options.directory)
}

const reportOperationFailure = (operation: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error)

  console.error(`\nFailed to ${operation}: ${message}`)

  process.exitCode = 1
}

const tryApplyPersistentBaseline = (
  result: ScanResult,
  options: CliOptions,
): ScanResult | null => {
  try {
    return applyPersistentBaseline(result, options)
  } catch (error) {
    reportOperationFailure('apply persistent baseline', error)

    return null
  }
}

const filterIntroducedProjectResults = async (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  projectResults: readonly ProjectScanResult[],
  filesToScan: readonly string[],
  baseScanOptions: BaseScanOptions,
): Promise<ProjectScanResult[]> => {
  const baseRevision = resolveBaseRevision(options.directory, getBaseOption(options))
  const introducedResults: ProjectScanResult[] = []

  for (const projectResult of projectResults) {
    const projectFiles = filesToScan.filter((filePath) =>
      isFileInDirectory(filePath, projectResult.directory)
    )

    const projectConfig = await loadConfig(projectResult.directory)
    const mergedConfig = mergeConfigs(config, projectConfig)

    const baseline = await scanBaseline({
      repositoryDirectory: options.directory,
      projectDirectory: projectResult.directory,
      files: projectFiles,
      baseRevision,
      scanOptions: {
        ...baseScanOptions,
        ignore: mergedConfig.ignore,
        rules: mergedConfig.rules,
        overrides: mergedConfig.overrides,
      },
    })

    const introducedResult = filterIntroducedDiagnostics(
      projectResult,
      baseline.result,
      projectResult.directory,
      baseline.rootDirectory,
    )

    introducedResults.push({
      ...introducedResult,
      name: projectResult.name,
      directory: projectResult.directory,
    })
  }

  return introducedResults
}

const tryScanProjects = async (
  options: Parameters<typeof scanProjects>[0],
): Promise<ProjectScanResult[] | null> => {
  try {
    return await scanProjects(options)
  } catch (error) {
    reportOperationFailure('scan projects', error)

    return null
  }
}

const tryFilterIntroducedProjectResults = async (
  options: CliOptions,
  config: AstroDoctorConfig,
  projectResults: readonly ProjectScanResult[],
  filesToScan: readonly string[],
  baseScanOptions: BaseScanOptions,
): Promise<ProjectScanResult[] | null> => {
  try {
    return await filterIntroducedProjectResults(
      options,
      config,
      projectResults,
      filesToScan,
      baseScanOptions,
    )
  } catch (error) {
    reportOperationFailure('compare baseline', error)

    return null
  }
}

const executeMultiProjectScan = async (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  effectiveProjects: string[],
  effectivePreset: PresetName,
  effectiveFailOn: string,
  effectiveThreshold: number,
  baseScanOptions: BaseScanOptions,
): Promise<void> => {
  const { files: filesToScan, failed } = tryResolveFilesToScan(options)

  const effectiveConfig: AstroDoctorConfig = {
    ...config,
    preset: effectivePreset,
    rules: getEffectiveRules(config, effectivePreset),
  }

  if (failed) return

  if (shouldPrintProgress(options)) {
    console.log(`\nScanning ${effectiveProjects.length} project(s) in ${options.directory}...\n`)
  }

  let projectResults = await tryScanProjects({
    rootDirectory: options.directory,
    projectArgs: effectiveProjects,
    rootConfig: effectiveConfig,
    scanOptions: {
      ...baseScanOptions,
      files: filesToScan,
    },
  })

  if (!projectResults) return

  if (options.scope === 'changed' && filesToScan) {
    projectResults = await tryFilterIntroducedProjectResults(
      options,
      effectiveConfig,
      projectResults,
      filesToScan,
      baseScanOptions,
    )

    if (!projectResults) return
  }

  if (options.baseline !== undefined) {
    try {
      projectResults = projectResults.map((projectResult) =>
        ({
          ...applyPersistentBaseline(projectResult, options),
          name: projectResult.name,
          directory: projectResult.directory,
        })
      )
    } catch (error) {
      reportOperationFailure('apply persistent baseline', error)

      return
    }
  }

  const aggregate = aggregateResults(projectResults)

  if (printReport(aggregate, options, projectResults)) return

  checkThresholds(aggregate, effectiveFailOn, effectiveThreshold)
}

interface BaseScanOptions {
  categories: readonly RuleCategory[] | undefined
  fix: boolean
  noLint: boolean
  noRespectInlineDisables: boolean
  cache: boolean
}

const resolveProjectsWithDiscovery = async (options: CliOptions, config: AstroDoctorConfig | null): Promise<string[]> => {
  const explicit = resolveEffectiveProjects(options, config)

  if (explicit.length > 0) return explicit

  const discovered = await autoDiscoverAstroProjects(options.directory)

  return discovered.length > 0 ? discovered.map((pkg) => pkg.directory) : []
}

const tryFilterIntroducedScanResult = async (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  effectivePreset: PresetName | undefined,
  baseScanOptions: BaseScanOptions,
  filesToScan: readonly string[],
  scanResult: ScanResult,
): Promise<ScanResult | null> => {
  try {
    const baseRevision = resolveBaseRevision(options.directory, getBaseOption(options))

    const baseline = await scanBaseline({
      repositoryDirectory: options.directory,
      projectDirectory: options.directory,
      files: filesToScan,
      baseRevision,
      scanOptions: {
        ...baseScanOptions,
        ignore: config?.ignore,
        rules: getEffectiveRules(config, effectivePreset),
        overrides: config?.overrides,
      },
    })

    return filterIntroducedDiagnostics(
      scanResult,
      baseline.result,
      options.directory,
      baseline.rootDirectory,
    )
  } catch (error) {
    reportOperationFailure('compare baseline', error)

    return null
  }
}

const resolveReportedScanResult = async (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  effectivePreset: PresetName | undefined,
  baseScanOptions: BaseScanOptions,
  filesToScan: readonly string[] | undefined,
  scanResult: ScanResult,
): Promise<ScanResult | null> => {
  const introducedResult = options.scope === 'changed' && filesToScan
    ? await tryFilterIntroducedScanResult(
        options,
        config,
        effectivePreset,
        baseScanOptions,
        filesToScan,
        scanResult,
      )
    : scanResult

  return introducedResult === null
    ? null
    : tryApplyPersistentBaseline(introducedResult, options)
}

const executeSingleDirectoryScan = async (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  effectivePreset: PresetName | undefined,
  effectiveFailOn: string,
  effectiveThreshold: number,
  baseScanOptions: BaseScanOptions,
): Promise<void> => {
  const { files: filesToScan, failed } = tryResolveFilesToScan(options)

  if (failed) return

  if (shouldSkipIrrelevantFiles(options, filesToScan)) return

  const scanOptions = {
    ...baseScanOptions,
    directory: options.directory,
    files: filesToScan,
    ignore: config?.ignore,
    rules: getEffectiveRules(config, effectivePreset),
    overrides: config?.overrides,
  }

  if (shouldPrintProgress(options)) {
    console.log(`\nScanning ${options.directory}...\n`)
  }

  const scanResult = await tryScan(scanOptions)

  if (!scanResult) return

  const effectiveScanResult = await resolveReportedScanResult(
    options,
    config,
    effectivePreset,
    baseScanOptions,
    filesToScan,
    scanResult,
  )

  if (!effectiveScanResult) return

  if (printReport(effectiveScanResult, options)) return

  checkThresholds(effectiveScanResult, effectiveFailOn, effectiveThreshold)
}

const executeScan = async (options: CliOptions): Promise<void> => {
  const config = await loadConfig(options.directory)
  const effectivePreset = getEffectivePreset(options, config)
  const effectiveFailOn = getEffectiveFailOn(options, config, effectivePreset)
  const effectiveThreshold = getEffectiveThreshold(options, config, effectivePreset)

  const baseScanOptions: BaseScanOptions = {
    categories: options.categories.length > 0 ? options.categories : undefined,
    fix: options.fix,
    noLint: options.noLint,
    noRespectInlineDisables: options.noRespectInlineDisables,
    cache: options.cache,
  }

  // ── Multi-project mode ──────────────────────────────────────────────────────
  const effectiveProjects = await resolveProjectsWithDiscovery(options, config)

  if (effectiveProjects.length > 0) {
    await executeMultiProjectScan(
      options,
      config,
      effectiveProjects,
      effectivePreset,
      effectiveFailOn,
      effectiveThreshold,
      baseScanOptions,
    )

    return
  }

  // ── Single-directory mode ───────────────────────────────────────────────────
  await executeSingleDirectoryScan(options, config, effectivePreset, effectiveFailOn, effectiveThreshold, baseScanOptions)
}

const removeValueOption = (argv: readonly string[], optionName: string): string[] => {
  const remainingArguments: string[] = []

  for (let argumentIndex = 0; argumentIndex < argv.length; argumentIndex++) {
    const argument = argv[argumentIndex]

    if (argument === optionName) {
      argumentIndex++

      continue
    }

    if (argument?.startsWith(`${optionName}=`)) continue

    if (argument !== undefined) remainingArguments.push(argument)
  }

  return remainingArguments
}

const createBaselineResult = async (
  options: CliOptions,
): Promise<ScanResult | null> => {
  const config = await loadConfig(options.directory)
  const effectivePreset = getEffectivePreset(options, config)
  const effectiveProjects = await resolveProjectsWithDiscovery(options, config)

  const scanOptions: BaseScanOptions = {
    categories: options.categories.length > 0 ? options.categories : undefined,
    fix: false,
    noLint: options.noLint,
    noRespectInlineDisables: options.noRespectInlineDisables,
    cache: options.cache,
  }

  if (effectiveProjects.length > 0) {
    const projectResults = await tryScanProjects({
      rootDirectory: options.directory,
      projectArgs: effectiveProjects,
      rootConfig: {
        ...config,
        preset: effectivePreset,
        rules: getEffectiveRules(config, effectivePreset),
      },
      scanOptions,
    })

    return projectResults ? aggregateResults(projectResults) : null
  }

  return tryScan({
    ...scanOptions,
    directory: options.directory,
    ignore: config?.ignore,
    overrides: config?.overrides,
    rules: getEffectiveRules(config, effectivePreset),
  })
}

const runBaselineCommand = async (argv: string[]): Promise<void> => {
  const action = argv[0]

  if (action !== 'create' && action !== 'update') {
    throw new Error('Usage: astro-doctor baseline create|update [--output <path>] [scan options]')
  }

  const outputValue = getOptionValue(argv, '--output')

  if (argv.includes('--output') && outputValue === undefined) {
    throw new Error('Option "--output" requires a value.')
  }

  const scanArguments = removeValueOption(argv.slice(1), '--output')
  const options = parseArguments(scanArguments)
  const result = await createBaselineResult(options)

  if (!result) return

  const outputPath = resolve(options.directory, outputValue ?? DEFAULT_BASELINE_FILE_NAME)

  writePersistentBaseline(
    outputPath,
    createPersistentBaseline(result, options.directory),
  )

  console.log(
    `Baseline written to ${outputPath} with ${result.diagnostics.length} finding${result.diagnostics.length === 1 ? '' : 's'}.`,
  )
}

// eslint-disable-next-line complexity
export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  const subcommand = argv[0]
  const noTelemetry = argv.includes('--no-telemetry') || process.env.ASTRO_DOCTOR_NO_TELEMETRY === '1'

  if (subcommand === 'init') {
    try {
      validateSimpleArguments(argv.slice(1), new Set(), new Set(['--preset']))

      trackRun({ command: 'init', flags: {} }, noTelemetry)

      runInit(argv.slice(1))
    } catch (error) {
      reportOperationFailure('parse init arguments', error)
    }

    return
  }

  if (subcommand === 'install') {
    try {
      validateSimpleArguments(
        argv.slice(1),
        new Set(['-y', '--yes', '--dry-run', '--agent-hooks']),
        new Set(),
      )

      trackRun({ command: 'install', flags: { dryRun: argv.includes('--dry-run') } }, noTelemetry)

      await runInstall(argv.slice(1))
    } catch (error) {
      reportOperationFailure('parse install arguments', error)
    }

    return
  }

  if (subcommand === 'why') {
    const location = argv[1]

    if (!location) {
      console.error(
        '\nUsage: astro-doctor why <file>:<line>\nExample: astro-doctor why src/pages/index.astro:42\n',
      )

      process.exitCode = 1

      return
    }

    trackRun({ command: 'why', flags: {} }, noTelemetry)

    await runWhy(location)

    return
  }

  if (subcommand === 'rules') {
    trackRun({ command: 'rules', flags: {} }, noTelemetry)

    runRulesExplain(argv.slice(1))

    return
  }

  if (subcommand === 'experimental-lsp') {
    try {
      validateSimpleArguments(argv.slice(1), new Set(['--stdio']), new Set())

      trackRun({ command: 'lsp', flags: {} }, noTelemetry)

      runLsp()
    } catch (error) {
      reportOperationFailure('parse LSP arguments', error)
    }

    return
  }

  if (subcommand === 'baseline') {
    trackRun({ command: 'baseline', flags: {} }, noTelemetry)

    try {
      await runBaselineCommand(argv.slice(1))
    } catch (error) {
      reportOperationFailure('manage baseline', error)
    }

    return
  }

  let options: CliOptions

  try {
    options = parseArguments(argv)
  } catch (error) {
    reportOperationFailure('parse arguments', error)

    return
  }

  if (options.version) {
    console.log(getPackageVersion())

    return
  }

  if (options.help) {
    printHelp()

    return
  }

  await executeScan(options)

  trackRun(
    {
      command: 'scan',
      flags: {
        staged: options.staged,
        diff: options.diff !== false,
        project: options.projects.length > 0,
        preset: options.preset !== undefined,
        noLint: options.noLint,
        verbose: options.verbose,
        quiet: options.quiet,
        json: options.json !== false,
        categories: options.categories.length > 0,
      },
    },
    options.noTelemetry,
  )
}
