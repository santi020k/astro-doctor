import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'

import { formatConsoleReport, formatProjectScoreTable, formatScoreOnly } from './report/console.js'
import { formatGithubReport } from './report/github.js'
import { formatJsonReport, serializeJsonReport } from './report/json.js'
import { scan } from './scanner/index.js'
import { isProjectAuditRelevantPath } from './scanner/project-audit.js'
import { loadConfig } from './config.js'
import {
  DISABLED_THRESHOLD_SCORE,
  MAXIMUM_THRESHOLD_SCORE,
  MINIMUM_THRESHOLD_SCORE,
} from './constants.js'
import { getDiffAstroFiles,getStagedAstroFiles } from './git.js'
import { runInit } from './init.js'
import { runInstall } from './install.js'
import { runLsp } from './lsp.js'
import { aggregateResults, autoDiscoverAstroProjects, scanProjects } from './multi-project.js'
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

type OutputFormat = 'console' | 'github'

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
  readonly categories: readonly RuleCategory[]
  readonly noLint: boolean
  readonly noRespectInlineDisables: boolean
  readonly projects: readonly string[]
  readonly noTelemetry: boolean
}

const VALID_CATEGORIES: RuleCategory[] = [
  'performance',
  'accessibility',
  'security',
  'best-practices',
]

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

const readChangedFiles = (filePath: string): string[] =>
  readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((changedFilePath) => changedFilePath.trim())
    .filter(Boolean)

const getVersion = (): string => {
  try {
    const require = createRequire(fileURLToPath(import.meta.url))
    const packageJson = require('../../package.json') as { version: string }

    return packageJson.version
  } catch {
    return '0.0.0'
  }
}

const parseCategories = (argv: readonly string[]): RuleCategory[] => {
  const values = getAllOptionValues(argv, '--category')
  const valid: RuleCategory[] = []

  for (const value of values) {
    if (VALID_CATEGORIES.includes(value as RuleCategory)) {
      valid.push(value as RuleCategory)
    } else {
      console.error(`\nUnknown category "${value}". Valid values: ${VALID_CATEGORIES.join(', ')}\n`)

      process.exitCode = 1
    }
  }

  return valid
}

const parsePreset = (argv: readonly string[]): PresetName | undefined => {
  const presetValue = getOptionValue(argv, '--preset')

  if (presetValue === undefined) return undefined

  if (isPresetName(presetValue)) return presetValue

  console.error('\nUnknown preset "' + presetValue + '". Valid values: recommended, strict, ci\n')

  process.exitCode = 1

  return undefined
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

const parseArguments = (argv: string[]): CliOptions => {
  const directoryArg = getOptionValue(argv, '--dir', '-d')
  const directory = directoryArg ? resolve(directoryArg) : process.cwd()
  const failOnValue = getOptionValue(argv, '--fail-on') ?? getOptionValue(argv, '--blocking')
  const failOnProvided = failOnValue !== undefined

  const failOn: CliOptions['failOn'] =
    failOnValue === 'warning' || failOnValue === 'off' ? failOnValue : 'error'

  const formatValue = getOptionValue(argv, '--format')
  const format: OutputFormat = formatValue === 'github' ? 'github' : 'console'
  const thresholdValue = getOptionValue(argv, '--threshold')
  const thresholdParsed = thresholdValue === undefined ? Number.NaN : Number.parseInt(thresholdValue, 10)

  const threshold = Number.isNaN(thresholdParsed)
    ? DISABLED_THRESHOLD_SCORE
    : Math.min(MAXIMUM_THRESHOLD_SCORE, Math.max(MINIMUM_THRESHOLD_SCORE, thresholdParsed))

  const changedFilesFrom = getOptionValue(argv, '--changed-files-from')

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
    failOn,
    failOnProvided,
    format,
    threshold,
    thresholdProvided: thresholdValue !== undefined,
    changedFilesFrom,
    staged: argv.includes('--staged'),
    diff: getDiffOption(argv),
    categories: parseCategories(argv),
    noLint: argv.includes('--no-lint'),
    noRespectInlineDisables: argv.includes('--no-respect-inline-disables'),
    projects: getProjectsOption(argv),
    noTelemetry: argv.includes('--no-telemetry') || process.env.ASTRO_DOCTOR_NO_TELEMETRY === '1',
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
  experimental-lsp         Start the experimental language server (--stdio)

Scan options:
  -d, --dir <path>                  Directory to scan (default: cwd)
      --diff [base]                 Scan files changed vs. a base branch (default: main/master)
      --staged                      Scan only git-staged Astro Doctor files (pre-commit)
      --changed-files-from <path>   Scan newline-separated changed files from a file
      --category <cat>              Filter to one category (repeat for multiple)
                                    Categories: performance | accessibility | security | best-practices
      --preset <name>               recommended (default) | strict | ci
      --no-lint                     Skip lint; report a clean result
      --no-respect-inline-disables  Audit mode: ignore eslint-disable comments

Output options:
      --score                       Print only the numeric health score (0–100)
      --no-score                    Omit the health score from the report
      --verbose                     Show per-rule summary alongside findings
      --json [path]                 Output a JSON report (stdout or a file)
      --json-compact                Compact single-line JSON (use with --json)
      --format <fmt>                console (default) | github
      --quiet                       Show errors only; suppress warnings from output

Exit / threshold options:
      --fail-on <level>             Exit 1 on severity: error | warning | off (default: error)
      --blocking <level>            Alias for --fail-on
      --threshold <score>           Exit 1 when health score is below this (0–100)

Other:
  -v, --version                     Print the installed version
  -h, --help                        Show this help message

Install options:
  init [--preset recommended|strict|ci]

  install [-y] [--dry-run] [--agent-hooks]
    -y, --yes      Skip all prompts
    --dry-run      Preview what would be installed without writing files
    --agent-hooks  Install native Claude Code and Cursor hooks

Configuration:
  Add a doctor.config.ts (or .js, .mjs, .cjs, .json, .jsonc) to your project root.
  Supports: preset, rules, ignore, failOn, threshold

Rules checked:
  Performance:    no-blocking-script, no-client-load-overuse, no-unprocessed-script-surprises,
                  require-image-dimensions, use-astro-image
  Accessibility:  no-missing-alt, no-missing-lang, require-island-fallback
  Security:       no-public-secret-env, no-set-html
  Best Practices: no-process-env, prefer-class-list, prefer-content-collections
  `)
}

const handleJsonOutput = (
  scanResult: ScanResult,
  options: CliOptions,
  projects?: readonly ProjectScanResult[],
): boolean => {
  const report = formatJsonReport(scanResult, options.directory, projects)
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
  preset: PresetName,
): Record<string, 'error' | 'warn' | 'off'> => ({
  ...getPresetRules(preset),
  ...config?.rules,
})

const isScanRelevantPath = (filePath: string): boolean =>
  filePath.endsWith('.astro') || isProjectAuditRelevantPath(filePath)

const resolveFilesToScan = (options: CliOptions): string[] | undefined => {
  if (options.staged) {
    const files = getStagedAstroFiles(options.directory)

    if (files.length === 0) {
      console.log('No staged Astro Doctor files found — nothing to scan.\n')
    }

    return files
  }

  if (options.diff !== false) {
    const base = typeof options.diff === 'string' ? options.diff : undefined
    const files = getDiffAstroFiles(options.directory, base)

    if (files.length === 0) {
      console.log('No changed Astro Doctor files found in diff — nothing to scan.\n')
    }

    return files
  }

  if (options.changedFilesFrom) {
    return readChangedFiles(options.changedFilesFrom)
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

const executeMultiProjectScan = async (
  options: CliOptions,
  config: AstroDoctorConfig | null,
  effectiveProjects: string[],
  effectiveFailOn: string,
  effectiveThreshold: number,
  baseScanOptions: { categories: readonly RuleCategory[] | undefined; noLint: boolean; noRespectInlineDisables: boolean },
): Promise<void> => {
  if (options.json !== true && !options.scoreOnly) {
    console.log(`\nScanning ${effectiveProjects.length} project(s) in ${options.directory}...\n`)
  }

  let projectResults: ProjectScanResult[]

  try {
    projectResults = await scanProjects({
      rootDirectory: options.directory,
      projectArgs: effectiveProjects,
      rootConfig: config,
      scanOptions: { ...baseScanOptions },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`\nFailed to scan projects: ${message}`)

    process.exitCode = 1

    return
  }

  const aggregate = aggregateResults(projectResults)

  if (printReport(aggregate, options, projectResults)) return

  checkThresholds(aggregate, effectiveFailOn, effectiveThreshold)
}

const executeScan = async (options: CliOptions): Promise<void> => {
  const config = await loadConfig(options.directory)
  const effectivePreset = getEffectivePreset(options, config)
  const effectiveFailOn = getEffectiveFailOn(options, config, effectivePreset)
  const effectiveThreshold = getEffectiveThreshold(options, config, effectivePreset)

  const baseScanOptions = {
    categories: options.categories.length > 0 ? options.categories : undefined,
    noLint: options.noLint,
    noRespectInlineDisables: options.noRespectInlineDisables,
  }

  // ── Multi-project mode ──────────────────────────────────────────────────────
  let effectiveProjects = resolveEffectiveProjects(options, config)

  if (effectiveProjects.length === 0) {
    const discovered = await autoDiscoverAstroProjects(options.directory)

    if (discovered.length > 0) {
      effectiveProjects = discovered.map((pkg) => pkg.directory)
    }
  }

  if (effectiveProjects.length > 0) {
    await executeMultiProjectScan(options, config, effectiveProjects, effectiveFailOn, effectiveThreshold, baseScanOptions)

    return
  }

  // ── Single-directory mode ───────────────────────────────────────────────────
  const { files: filesToScan, failed } = tryResolveFilesToScan(options)

  if (failed) return

  if (hasOnlyIrrelevantChangedFiles(filesToScan)) {
    if (options.json !== true) {
      console.log('No Astro Doctor files found in the changed files list — nothing to scan.\n')
    }

    return
  }

  const scanOptions = {
    ...baseScanOptions,
    directory: options.directory,
    files: filesToScan,
    ignore: config?.ignore,
    rules: getEffectiveRules(config, effectivePreset),
  }

  if (options.json !== true && !options.scoreOnly) {
    console.log(`\nScanning ${options.directory}...\n`)
  }

  const scanResult = await tryScan(scanOptions)

  if (!scanResult) return

  if (printReport(scanResult, options)) return

  checkThresholds(scanResult, effectiveFailOn, effectiveThreshold)
}

export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  const subcommand = argv[0]
  const noTelemetry = argv.includes('--no-telemetry') || process.env.ASTRO_DOCTOR_NO_TELEMETRY === '1'

  if (subcommand === 'init') {
    trackRun({ command: 'init', flags: {} }, noTelemetry)

    runInit(argv.slice(1))

    return
  }

  if (subcommand === 'install') {
    trackRun({ command: 'install', flags: { dryRun: argv.includes('--dry-run') } }, noTelemetry)

    await runInstall(argv.slice(1))

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
    trackRun({ command: 'lsp', flags: {} }, noTelemetry)

    runLsp()

    return
  }

  const options = parseArguments(argv)

  if (options.version) {
    console.log(getVersion())

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
