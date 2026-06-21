import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { formatConsoleReport, formatScoreOnly } from './report/console.js'
import { formatGithubReport } from './report/github.js'
import { formatJsonReport, serializeJsonReport } from './report/json.js'
import { scan } from './scanner/index.js'
import { loadConfig } from './config.js'
import { runInstall } from './install.js'
import { runLsp } from './lsp.js'
import { runWhy } from './why.js'
import { runRulesExplain } from './rules-explain.js'
import { getStagedAstroFiles, getDiffAstroFiles } from './git.js'
import type { AstroDoctorConfig, ScanResult } from './types.js'
import type { RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'

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
  readonly failOn: 'error' | 'warning' | 'off'
  readonly format: OutputFormat
  readonly threshold: number
  readonly changedFilesFrom?: string
  readonly staged: boolean
  readonly diff: string | boolean
  readonly categories: readonly RuleCategory[]
  readonly noLint: boolean
  readonly noRespectInlineDisables: boolean
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

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const inlinePrefix = `${optionName}=`

    if (arg.startsWith(inlinePrefix)) {
      values.push(arg.slice(inlinePrefix.length))
    } else if (arg === optionName && i + 1 < argv.length && !argv[i + 1]!.startsWith('-')) {
      values.push(argv[i + 1]!)
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

const parseArguments = (argv: string[]): CliOptions => {
  const directoryArg = getOptionValue(argv, '--dir', '-d')
  const directory = directoryArg ? resolve(directoryArg) : process.cwd()
  const failOnValue = getOptionValue(argv, '--fail-on') ?? getOptionValue(argv, '--blocking')
  const failOn: CliOptions['failOn'] =
    failOnValue === 'warning' || failOnValue === 'off' ? failOnValue : 'error'
  const formatValue = getOptionValue(argv, '--format')
  const format: OutputFormat = formatValue === 'github' ? 'github' : 'console'
  const thresholdValue = getOptionValue(argv, '--threshold')
  const thresholdParsed = thresholdValue === undefined ? Number.NaN : Number.parseInt(thresholdValue, 10)
  const threshold = Number.isNaN(thresholdParsed) ? -1 : Math.min(100, Math.max(0, thresholdParsed))
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
    failOn,
    format,
    threshold,
    changedFilesFrom,
    staged: argv.includes('--staged'),
    diff: getDiffOption(argv),
    categories: parseCategories(argv),
    noLint: argv.includes('--no-lint'),
    noRespectInlineDisables: argv.includes('--no-respect-inline-disables'),
  }
}

const printHelp = (): void => {
  console.log(`
astro-doctor — Your agent writes bad Astro. This catches it.

Usage:
  astro-doctor [command] [options]

Commands:
  (no command)             Scan the current directory
  install                  Set up GitHub Actions, agent skills, and hooks
  why <file>:<line>        Explain the issue at a specific file location
  rules                    List all rules
  rules explain <rule-id>  Explain a rule in detail
  experimental-lsp         Start the experimental language server (--stdio)

Scan options:
  -d, --dir <path>                  Directory to scan (default: cwd)
      --diff [base]                 Scan files changed vs. a base branch (default: main/master)
      --staged                      Scan only git-staged .astro files (pre-commit)
      --changed-files-from <path>   Scan newline-separated changed files from a file
      --category <cat>              Filter to one category (repeat for multiple)
                                    Categories: performance | accessibility | security | best-practices
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
  install [-y] [--dry-run] [--agent-hooks]
    -y, --yes      Skip all prompts
    --dry-run      Preview what would be installed without writing files
    --agent-hooks  Install native Claude Code and Cursor hooks

Configuration:
  Add a doctor.config.ts (or .js, .mjs, .cjs, .json, .jsonc) to your project root.
  Supports: rules, ignore, failOn, threshold

Rules checked:
  Performance:    no-blocking-script, no-client-load-overuse, use-astro-image
  Accessibility:  no-missing-alt, no-missing-lang
  Security:       no-set-html
  Best Practices: no-process-env, prefer-class-list, prefer-content-collections
  `)
}

const handleJsonOutput = (scanResult: ScanResult, options: CliOptions): boolean => {
  const report = formatJsonReport(scanResult, options.directory)
  const reportJson = serializeJsonReport(report, options.jsonCompact)

  if (typeof options.json === 'string') {
    writeFileSync(options.json, reportJson, 'utf8')
    console.log(`JSON report written to ${options.json}`)

    return false
  }

  console.log(reportJson)

  return true
}

const printReport = (scanResult: ScanResult, options: CliOptions): boolean => {
  if (options.scoreOnly) {
    console.log(formatScoreOnly(scanResult))

    return true
  }

  if (options.json !== false) {
    if (handleJsonOutput(scanResult, options)) return true
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

const getEffectiveFailOn = (options: CliOptions, config: AstroDoctorConfig | null): CliOptions['failOn'] =>
  options.failOn === 'error' ? (config?.failOn ?? 'error') : options.failOn

const getEffectiveThreshold = (options: CliOptions, config: AstroDoctorConfig | null): number =>
  options.threshold === -1 ? (config?.threshold ?? -1) : options.threshold

const resolveFilesToScan = (options: CliOptions): string[] | undefined => {
  if (options.staged) {
    const files = getStagedAstroFiles(options.directory)

    if (files.length === 0) {
      console.log('No staged .astro files found — nothing to scan.\n')
    }

    return files
  }

  if (options.diff !== false) {
    const base = typeof options.diff === 'string' ? options.diff : undefined
    const files = getDiffAstroFiles(options.directory, base)

    if (files.length === 0) {
      console.log('No changed .astro files found in diff — nothing to scan.\n')
    }

    return files
  }

  if (options.changedFilesFrom) {
    return readChangedFiles(options.changedFilesFrom)
  }

  return undefined
}

const executeScan = async (options: CliOptions): Promise<void> => {
  const config = await loadConfig(options.directory)

  let filesToScan: string[] | undefined

  try {
    filesToScan = resolveFilesToScan(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`\nFailed to resolve files: ${message}`)
    process.exitCode = 1

    return
  }

  if (
    filesToScan !== undefined &&
    filesToScan.length > 0 &&
    !filesToScan.some((f) => f.endsWith('.astro'))
  ) {
    if (options.json !== true) {
      console.log('No .astro files found in the changed files list — nothing to scan.\n')
    }

    return
  }

  const scanOptions = {
    directory: options.directory,
    files: filesToScan,
    ignore: config?.ignore,
    rules: config?.rules,
    categories: options.categories.length > 0 ? options.categories : undefined,
    noLint: options.noLint,
    noRespectInlineDisables: options.noRespectInlineDisables,
  }

  const effectiveFailOn = getEffectiveFailOn(options, config)
  const effectiveThreshold = getEffectiveThreshold(options, config)

  if (options.json !== true && !options.scoreOnly) {
    console.log(`\nScanning ${options.directory}...\n`)
  }

  let scanResult: ScanResult

  try {
    scanResult = await scan(scanOptions)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`\nFailed to scan: ${message}`)
    process.exitCode = 1

    return
  }

  if (printReport(scanResult, options)) return

  checkThresholds(scanResult, effectiveFailOn, effectiveThreshold)
}

export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  const subcommand = argv[0]

  if (subcommand === 'install') {
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

    await runWhy(location)

    return
  }

  if (subcommand === 'rules') {
    runRulesExplain(argv.slice(1))

    return
  }

  if (subcommand === 'experimental-lsp') {
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
}
