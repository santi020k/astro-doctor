import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { formatConsoleReport } from './report/console.js'
import { formatGithubReport } from './report/github.js'
import { formatJsonReport } from './report/json.js'
import { scan } from './scanner/index.js'
import { loadConfig } from './config.js'
import { runInstall } from './install.js'
import { runLsp } from './lsp.js'
import type { ScanResult } from './types.js'

type OutputFormat = 'console' | 'github'

interface CliOptions {
  readonly directory: string
  readonly help: boolean
  readonly json: string | boolean  // false = off, true = stdout, string = file path
  readonly noScore: boolean
  readonly failOn: 'error' | 'warning' | 'off'
  readonly format: OutputFormat
  /** Exit 1 when health score falls below this threshold (0–100). -1 = not set. */
  readonly threshold: number
}

const parseArguments = (argv: string[]): CliOptions => {
  const directory = (() => {
    const directoryIndex = argv.findIndex((argument) => argument === '--dir' || argument === '-d')
    const directoryArg = directoryIndex === -1 ? undefined : argv[directoryIndex + 1]

    return directoryArg ? resolve(directoryArg) : process.cwd()
  })()

  const jsonIndex = argv.findIndex((argument) => argument === '--json')

  const json: CliOptions['json'] = (() => {
    if (jsonIndex === -1) return false

    const nextArg = argv[jsonIndex + 1]

    if (nextArg && !nextArg.startsWith('-')) return nextArg

    return true
  })()

  const failOnIndex = argv.findIndex((argument) => argument === '--fail-on')
  const failOnValue = failOnIndex === -1 ? undefined : argv[failOnIndex + 1]

  const failOn: CliOptions['failOn'] =
    failOnValue === 'warning' || failOnValue === 'off' ? failOnValue : 'error'

  const formatIndex = argv.findIndex((argument) => argument === '--format')
  const formatValue = formatIndex === -1 ? undefined : argv[formatIndex + 1]
  const format: OutputFormat = formatValue === 'github' ? 'github' : 'console'
  const thresholdIndex = argv.findIndex((argument) => argument === '--threshold')
  const thresholdValue = thresholdIndex === -1 ? undefined : argv[thresholdIndex + 1]
  const thresholdParsed = thresholdValue === undefined ? Number.NaN : Number.parseInt(thresholdValue, 10)
  const threshold = Number.isNaN(thresholdParsed) ? -1 : Math.min(100, Math.max(0, thresholdParsed))

  return {
    directory,
    help: argv.includes('--help') || argv.includes('-h'),
    json,
    noScore: argv.includes('--no-score'),
    failOn,
    format,
    threshold,
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
      --no-score           Omit the health score from the report
      --fail-on <level>    Exit 1 when this severity is found: error | warning | off
                           (default: error)
  -h, --help               Show this help message

Rules checked:
  no-client-load-overuse   Prefer client:idle / client:visible over client:load
  use-astro-image          Use <Image> from astro:assets instead of <img>
  no-missing-alt           All images must have an alt attribute
  no-set-html              Avoid set:html to prevent XSS
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

// eslint-disable-next-line complexity
const executeScan = async (options: CliOptions): Promise<void> => {
  const config = await loadConfig(options.directory).catch(() => null)

  const scanOptions = {
    directory: options.directory,
    ignore: config?.ignore,
    rules: config?.rules,
  }

  const effectiveFailOn = options.failOn === 'error' ? (config?.failOn ?? 'error') : options.failOn
  // CLI flag wins; fall back to config; -1 means "not set"
  const effectiveThreshold = options.threshold === -1 ? (config?.threshold ?? -1) : options.threshold

  console.log(`\nScanning ${options.directory}...\n`)

  const scanResult = await scan(scanOptions)

  if (options.json !== false) {
    if (handleJsonOutput(scanResult, options)) return
  } else if (options.format === 'github') {
    const githubOutput = formatGithubReport(scanResult)

    if (githubOutput) console.log(githubOutput)
  } else {
    // Default: colored console output grouped by file
    const report = formatConsoleReport(scanResult, options.directory, !options.noScore)

    console.log(report)
  }

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
