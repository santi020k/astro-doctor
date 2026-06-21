import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import { glob } from 'glob'

const DEFAULT_IGNORED_DIRECTORIES = ['node_modules', 'dist', '.astro', '.turbo', 'coverage']
const ASTRO_FILE_EXTENSION = '.astro'
const ASTRO_FILE_GLOB = '**/*.astro'

const buildIgnorePatterns = (extraIgnore: readonly string[] = []): string[] => [
  ...DEFAULT_IGNORED_DIRECTORIES.map((directory) => `**/${directory}/**`),
  ...extraIgnore,
]

const toAbsolutePath = (rootDirectory: string, filePath: string): string =>
  isAbsolute(filePath) ? filePath : resolve(rootDirectory, filePath)

export const discoverAstroFiles = async (
  rootDirectory: string,
  ignore: readonly string[] = [],
): Promise<string[]> => {
  const discoveredFiles = await glob(ASTRO_FILE_GLOB, {
    cwd: rootDirectory,
    absolute: true,
    ignore: buildIgnorePatterns(ignore),
  })

  return discoveredFiles.sort()
}

export const resolveAstroFiles = (
  rootDirectory: string,
  filePaths: readonly string[],
): string[] =>
  filePaths
    .filter((filePath) => filePath.endsWith(ASTRO_FILE_EXTENSION))
    .map((filePath) => toAbsolutePath(rootDirectory, filePath))
    .filter((filePath) => existsSync(filePath))
    .sort()
