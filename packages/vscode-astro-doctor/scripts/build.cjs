'use strict'

const { rmSync } = require('node:fs')
const { createRequire } = require('node:module')
const { dirname, resolve } = require('node:path')
const { build } = require('esbuild')
const PACKAGE_ROOT = resolve(__dirname, '..')
const DIST_PATH = resolve(PACKAGE_ROOT, 'dist')
const ASTRO_DOCTOR_ROOT = resolve(PACKAGE_ROOT, '../astro-doctor')
const requireFromAstroDoctor = createRequire(resolve(ASTRO_DOCTOR_ROOT, 'package.json'))
const ASTRO_ESLINT_PARSER_PACKAGE_PATH = requireFromAstroDoctor.resolve('astro-eslint-parser/package.json')
const requireFromAstroEslintParser = createRequire(ASTRO_ESLINT_PARSER_PACKAGE_PATH)
const ASTRO_COMPILER_SYNC_PACKAGE_PATH = requireFromAstroEslintParser.resolve('astrojs-compiler-sync/package.json')

const ASTRO_COMPILER_WORKER_PATH = resolve(
  dirname(ASTRO_COMPILER_SYNC_PACKAGE_PATH),
  'lib/astrojs-compiler-worker.js',
)

const SERVER_ENTRY = 'import { runLsp } from "../astro-doctor/src/lsp.js"\n\nrunLsp()\n'

const SERVER_BANNER = [
  'import { createRequire as __createRequire } from "node:module";',
  'import { dirname as __pathDirname } from "node:path";',
  'import { fileURLToPath as __fileURLToPath } from "node:url";',
  'const require = __createRequire(import.meta.url);',
  'const __filename = __fileURLToPath(import.meta.url);',
  'const __dirname = __pathDirname(__filename);',
].join(' ')

const run = async () => {
  rmSync(DIST_PATH, { force: true, recursive: true })

  await Promise.all([
    build({
      bundle: true,
      entryPoints: [resolve(PACKAGE_ROOT, 'src/extension.ts')],
      external: ['vscode'],
      format: 'cjs',
      outfile: resolve(DIST_PATH, 'extension.js'),
      platform: 'node',
    }),
    build({
      banner: { js: SERVER_BANNER },
      bundle: true,
      format: 'esm',
      outfile: resolve(DIST_PATH, 'server.mjs'),
      platform: 'node',
      stdin: {
        contents: SERVER_ENTRY,
        loader: 'ts',
        resolveDir: PACKAGE_ROOT,
        sourcefile: 'server-entry.ts',
      },
    }),
    build({
      bundle: true,
      entryPoints: [ASTRO_COMPILER_WORKER_PATH],
      format: 'esm',
      outfile: resolve(DIST_PATH, 'astrojs-compiler-worker.js'),
      platform: 'node',
    }),
  ])
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)

  process.exitCode = 1
})
