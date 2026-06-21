import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { formatConsoleReport } from './report/console.js'
import { formatGithubReport } from './report/github.js'
import { formatJsonReport } from './report/json.js'
import { scan } from './scanner/index.js'
import { loadConfig } from './config.js'
import { runInstall } from './install.js'
import { runLsp } from './lsp.js'
import type { AstroDoctorConfig, ScanResult } from './types.js'

type OutputFormat = 'console' | 'github'

interface CliOptions {
  readonly directory: string
  readonly help: boolean
  readonly json: string | boolean
  readonly noScore: boolean
  readonly failOn: 'error' | 'warning' | 'off'
  readonly format: OutputFormat
  readonly threshold: number
  readonly changedFilesFrom?: string
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

const getJsonOption = (argv: readonly string[]): CliOptions['json'] => {
  const jsonValue = getOptionValue(argv, '--json')

  if (jsonValue !== undefined) return jsonValue

  if (argv.includes('--json')) return true

  return false
}

const readChangedFiles = (filePath: string): string[] =>
  readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((changedFilePath) => changedFilePath.trim())
    .filter(Boolean)

const parseArguments = (argv: string[]): CliOptions => {
  const directoryArg = getOptionValue(argv, '--dir', '-d')
  const directory = directoryArg ? resolve(directoryArg) : process.cwd()
  const failOnValue = getOptionValue(argv, '--fail-on')

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
    json: getJsonOption(argv),
    noScore: argv.includes('--no-score'),
    failOn,
    format,
    threshold,
    changedFilesFrom,
  }
}

const printHelp = (): void => {
  console.log(`
astro-doctor — Your agent writes bad Astro. This catches it.

Usage:
  astro-doctor [command] [options]

Commands:
  (no command)             Scan the current directory
  install                  Install the agent skill into your project
  experimental-lsp         Start the experimental language server (--stdio)

Options:
  -d, --dir <path>         Directory to scan (default: current working directory)
      --json [path]        Output a JSON report (to stdout or a file path)
      --format <fmt>       Output format: console (default) | github
                           Use --format=github for GitHub Actions inline annotations
      --threshold <score>  Exit 1 when health score falls below this value (0–100)
      --changed-files-from <path>
                           Scan newline-separated changed files from a path
      --no-score           Omit the health score from the report
      --fail-on <level>    Exit 1 when this severity is found: error | warning | off
                           (default: error)
  -h, --help               Show this help message

Rules checked:
  Performance:
    no-blocking-script       <script src> must have defer, async, or type="module"
    no-client-load-overuse   Prefer client:idle / client:visible over client:load
    use-astro-image          Use <Image> from astro:assets instead of <img>
  Accessibility:
    no-missing-alt           All images must have an alt attribute
    no-missing-lang          <html> must have a lang attribute
  Security:
    no-set-html              Avoid set:html to prevent XSS
  Best practices:
    no-process-env           Use import.meta.env instead of process.env
    prefer-class-list        Use class:list for dynamic class names

Configuration:
  Add a doctor.config.ts (or .js, .mjs, .cjs, .json, .jsonc) to your project root.
  Supports: rules, ignore, failOn, threshold
  `)
}

const handleJsonOutput = (scanResult: ScanResult, options: CliOptions): boolean => {
  const report = formatJsonReport(scanResult, options.directory)
  const reportJson = JSON.stringify(report, null, 2)

  if (typeof options.json === 'string') {
    writeFileSync(options.json, reportJson, 'utf8')

    console.log(`JSON report written to ${options.json}`)

    return false
  }

  console.log(reportJson)

  return true
}

const printReport = (scanResult: ScanResult, options: CliOptions): boolean => {
  if (options.json !== false) {
    if (handleJsonOutput(scanResult, options)) return true
  } else if (options.format === 'github') {
    const githubOutput = formatGithubReport(scanResult)

    if (githubOutput) console.log(githubOutput)
  } else {
    // Default: colored console output grouped by file
    const report = formatConsoleReport(scanResult, options.directory, !options.noScore)

    console.log(report)
  }

  return false
}

const checkThresholds = (scanResult: ScanResult, effectiveFailOn: string, effectiveThreshold: number): void => {
  // Exit code: severity gate
  const shouldFailOnSeverity =
    (effectiveFailOn === 'error' && scanResult.errorCount > 0) ||
    (effectiveFailOn === 'warning' && (scanResult.errorCount > 0 || scanResult.warningCount > 0))

  // Exit code: score threshold gate
  const shouldFailOnThreshold = effectiveThreshold !== -1 && scanResult.score < effectiveThreshold

  if (shouldFailOnSeverity || shouldFailOnThreshold) {
    if (shouldFailOnThreshold && !shouldFailOnSeverity) {
      console.error(`\nScore ${scanResult.score}/100 is below threshold of ${effectiveThreshold}. Failing.`)
    }

    process.exitCode = 1
  }
}

const getEffectiveFailOn = (options: CliOptions, config: AstroDoctorConfig | null) => options.failOn === 'error' ? (config?.failOn ?? 'error') : options.failOn
const getEffectiveThreshold = (options: CliOptions, config: AstroDoctorConfig | null) => options.threshold === -1 ? (config?.threshold ?? -1) : options.threshold

const executeScan = async (options: CliOptions): Promise<void> => {
  const config = await loadConfig(options.directory)

  const scanOptions = {
    directory: options.directory,
    files: options.changedFilesFrom ? readChangedFiles(options.changedFilesFrom) : undefined,
    ignore: config?.ignore,
    rules: config?.rules,
  }

  const effectiveFailOn = getEffectiveFailOn(options, config)
  const effectiveThreshold = getEffectiveThreshold(options, config)

  if (options.json !== true) console.log(`\nScanning ${options.directory}...\n`)

  const scanResult = await scan(scanOptions)

  if (printReport(scanResult, options)) return

  checkThresholds(scanResult, effectiveFailOn, effectiveThreshold)
}

export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  // Subcommands
  const subcommand = argv[0]

  if (subcommand === 'install') {
    runInstall()

    return
  }

  if (subcommand === 'experimental-lsp') {
    runLsp()

    return
  }

  const options = parseArguments(argv)

  if (options.help) {
    printHelp()

    return
  }

  await executeScan(options)
}
