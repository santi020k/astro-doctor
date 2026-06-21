import { glob } from 'glob'

const IGNORED_DIRECTORIES = ['node_modules', 'dist', '.astro', '.turbo', 'coverage']

const buildIgnorePattern = (): string[] =>
  IGNORED_DIRECTORIES.map((directory) => `**/${directory}/**`)

export const discoverAstroFiles = async (rootDirectory: string): Promise<string[]> => {
  const discoveredFiles = await glob('**/*.astro', {
    cwd: rootDirectory,
    absolute: true,
    ignore: buildIgnorePattern(),
  })

  return discoveredFiles.sort()
}
