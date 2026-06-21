import { resolve } from 'node:path'
import { scan } from './scanner/index.js'
import { formatConsoleReport } from './report/console.js'

const parseArguments = (argv: string[]): { directory: string; help: boolean } => {
  const helpFlag = argv.includes('--help') || argv.includes('-h')
  const directoryIndex = argv.findIndex((argument) => argument === '--dir' || argument === '-d')
  const directory =
    directoryIndex !== -1 && argv[directoryIndex + 1]
      ? resolve(argv[directoryIndex + 1] as string)
      : process.cwd()

  return { directory, help: helpFlag }
}

const printHelp = (): void => {
  console.log(`
astro-doctor — Your agent writes bad Astro. This catches it.

Usage:
  astro-doctor [options]

Options:
  -d, --dir <path>   Directory to scan (default: current working directory)
  -h, --help         Show this help message

Rules checked:
  no-client-load-overuse  Prefer client:idle / client:visible over client:load
  use-astro-image         Use <Image> from astro:assets instead of <img>
  no-missing-alt          All images must have an alt attribute
  no-set-html             Avoid set:html to prevent XSS
  prefer-class-list       Use class:list for dynamic class names
  `)
}

export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<void> => {
  const { directory, help } = parseArguments(argv)

  if (help) {
    printHelp()
    return
  }

  console.log(`\nScanning ${directory}...\n`)

  const scanResult = await scan({ directory })
  const report = formatConsoleReport(scanResult, directory)

  console.log(report)

  if (scanResult.errorCount > 0) {
    process.exitCode = 1
  }
}
