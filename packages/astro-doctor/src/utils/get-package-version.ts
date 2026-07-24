import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = '@santi020k/astro-doctor'
const UNKNOWN_VERSION = '0.0.0'

interface PackageMetadata {
  readonly name?: string
  readonly version?: string
}

const isPackageMetadata = (value: unknown): value is PackageMetadata =>
  typeof value === 'object' && value !== null

export const getPackageVersion = (): string => {
  let currentDirectory = dirname(fileURLToPath(import.meta.url))

  for (;;) {
    const packageJsonPath = join(currentDirectory, 'package.json')

    if (existsSync(packageJsonPath)) {
      try {
        const packageMetadata: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

        if (
          isPackageMetadata(packageMetadata) &&
          packageMetadata.name === PACKAGE_NAME &&
          typeof packageMetadata.version === 'string'
        ) {
          return packageMetadata.version
        }
      } catch {
        return UNKNOWN_VERSION
      }
    }

    const parentDirectory = dirname(currentDirectory)

    if (parentDirectory === currentDirectory) return UNKNOWN_VERSION

    currentDirectory = parentDirectory
  }
}
