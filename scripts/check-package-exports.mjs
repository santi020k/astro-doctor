import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const packageDirectory = process.cwd()
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-attw-'))
const packageManagerExecutable = process.env.npm_execpath

if (!packageManagerExecutable) {
  throw new Error('This check must be run through pnpm')
}

try {
  execFileSync(
    process.execPath,
    [
      packageManagerExecutable,
      'pack',
      '--pack-destination',
      temporaryDirectory,
    ],
    {
      cwd: packageDirectory,
      stdio: 'pipe',
    },
  )

  const tarballName = readdirSync(temporaryDirectory)
    .find(fileName => fileName.endsWith('.tgz'))

  if (!tarballName) {
    throw new Error('pnpm pack did not create a package tarball')
  }

  execFileSync(
    process.execPath,
    [
      packageManagerExecutable,
      'exec',
      'attw',
      join(temporaryDirectory, tarballName),
      '--profile',
      'esm-only',
    ],
    {
      cwd: packageDirectory,
      stdio: 'inherit',
    },
  )
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
