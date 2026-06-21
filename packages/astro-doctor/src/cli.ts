import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { formatConsoleReport } from './report/console.js'
import { formatJsonReport } from './report/json.js'
import { scan } from './scanner/index.js'
import { loadConfig } from './config.js'
import { runInstall } from './install.js'
import { runLsp } from './lsp.js'

interface CliOptions {
  readonly directory: string
  readonly help: boolean
  readonly json: string | boolean  // false = off, true = stdout, string = file path
  readonly noScore: boolean
  readonly failOn: 'error' | 'warning' | 'off'
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

  return {
    directory,
    help: argv.includes('--help') || argv.includes('-h'),
    json,
    noScore: argv.includes('--no-score'),
    failOn,
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
  `)
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

  // Load config (merge with CLI flags — CLI wins)
  const config = await loadConfig(options.directory).catch(() => null)

  const scanOptions = {
    directory: options.directory,
    ignore: config?.ignore,
    rules: config?.rules,
  }

  const effectiveFailOn = options.failOn === 'error' ? (config?.failOn ?? 'error') : options.failOn

  console.log(`\nScanning ${options.directory}...\n`)

  const scanResult = await scan(scanOptions)

  // JSON output
  if (options.json !== false) {
    const report = formatJsonReport(scanResult, options.directory)
    const reportJson = JSON.stringify(report, null, 2)

    if (typeof options.json === 'string') {
      writeFileSync(options.json, reportJson, 'utf8')

      console.log(`JSON report written to ${options.json}`)
    } else {
      console.log(reportJson)

      return
    }
  }

  // Console output
  const report = formatConsoleReport(scanResult, options.directory, !options.noScore)

  console.log(report)

  // Exit code
  const shouldFail =
    (effectiveFailOn === 'error' && scanResult.errorCount > 0) ||
    (effectiveFailOn === 'warning' && (scanResult.errorCount > 0 || scanResult.warningCount > 0))

  if (shouldFail) {
    process.exitCode = 1
  }
}
