import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { PresetName } from './presets.js'
import { isPresetName } from './presets.js'

interface InitFile {
  readonly path: string
  readonly content: string
}

interface InitResult {
  readonly created: readonly string[]
  readonly skipped: readonly string[]
}

const ESLINT_CONFIG_FILE_NAMES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.ts']

const getOptionValue = (argv: readonly string[], optionName: string): string | undefined => {
  const inlinePrefix = `${optionName}=`
  const inlineArgument = argv.find((argument) => argument.startsWith(inlinePrefix))

  if (inlineArgument) return inlineArgument.slice(inlinePrefix.length)

  const optionIndex = argv.findIndex((argument) => argument === optionName)

  if (optionIndex === -1) return undefined

  const optionValue = argv[optionIndex + 1]

  return optionValue?.startsWith('-') ? undefined : optionValue
}

const getPreset = (argv: readonly string[]): PresetName | undefined => {
  const presetValue = getOptionValue(argv, '--preset')

  if (presetValue === undefined) return 'recommended'

  if (isPresetName(presetValue)) return presetValue

  console.error('\nUnknown preset "' + presetValue + '". Valid values: recommended, strict, ci\n')

  process.exitCode = 1

  return undefined
}

const getDoctorConfig = (preset: PresetName): string => [
  "import type { AstroDoctorConfig } from '@santi020k/astro-doctor'",
  '',
  'export default {',
  `  preset: '${preset}',`,
  "} satisfies AstroDoctorConfig",
  '',
].join('\n')

const getEslintConfig = (): string => [
  "import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'",
  '',
  'export default [',
  '  astroDoctorPlugin.configs.recommended,',
  ']',
  '',
].join('\n')

const getGithubWorkflow = (): string => [
  'name: Astro Doctor',
  '',
  'on:',
  '  pull_request:',
  '    types: [opened, synchronize, reopened, ready_for_review]',
  '',
  'permissions:',
  '  contents: read',
  '  pull-requests: write',
  '',
  'concurrency:',
  '  group: astro-doctor-${{ github.event.pull_request.number || github.ref }}',
  '  cancel-in-progress: true',
  '',
  'jobs:',
  '  astro-doctor:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '        with:',
  '          fetch-depth: 0',
  '      - uses: santi020k/astro-doctor@v1',
  '        with:',
  "          fail-on: 'error'",
  '',
].join('\n')

const getInitFiles = (preset: PresetName, directory: string): InitFile[] => {
  const hasEslintConfig = ESLINT_CONFIG_FILE_NAMES.some((fileName) =>
    existsSync(resolve(directory, fileName)),
  )

  return [
    {
      path: 'doctor.config.ts',
      content: getDoctorConfig(preset),
    },
    ...(hasEslintConfig
      ? []
      : [
          {
            path: 'eslint.config.js',
            content: getEslintConfig(),
          },
        ]),
    {
      path: '.github/workflows/astro-doctor.yml',
      content: getGithubWorkflow(),
    },
  ]
}

export const runInit = (argv: readonly string[] = [], directory = process.cwd()): InitResult => {
  const preset = getPreset(argv)

  if (preset === undefined) return { created: [], skipped: [] }

  const created: string[] = []
  const skipped: string[] = []

  for (const initFile of getInitFiles(preset, directory)) {
    const filePath = resolve(directory, initFile.path)

    if (existsSync(filePath)) {
      skipped.push(initFile.path)

      continue
    }

    mkdirSync(dirname(filePath), { recursive: true })

    writeFileSync(filePath, initFile.content, 'utf8')

    created.push(initFile.path)
  }

  console.log('\nAstro Doctor init complete.\n')

  if (created.length > 0) console.log(`Created: ${created.join(', ')}`)

  if (skipped.length > 0) console.log(`Skipped existing files: ${skipped.join(', ')}`)

  return { created, skipped }
}
