import { glob } from 'glob'

const DEFAULT_IGNORED_DIRECTORIES = ['node_modules', 'dist', '.astro', '.turbo', 'coverage']

const buildIgnorePatterns = (extraIgnore: readonly string[] = []): string[] => [
  ...DEFAULT_IGNORED_DIRECTORIES.map((directory) => `**/${directory}/**`),
  ...extraIgnore,
]

export const discoverAstroFiles = async (
  rootDirectory: string,
  ignore: readonly string[] = [],
): Promise<string[]> => {
  const discoveredFiles = await glob('**/*.astro', {
    cwd: rootDirectory,
    absolute: true,
    ignore: buildIgnorePatterns(ignore),
  })

  return discoveredFiles.sort()
}
