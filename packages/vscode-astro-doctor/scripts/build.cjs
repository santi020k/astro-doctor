'use strict'

const { copyFileSync, rmSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const { build } = require('esbuild')
const PACKAGE_ROOT = resolve(__dirname, '..')
const DIST_PATH = resolve(PACKAGE_ROOT, 'dist')

const ASTRO_ESLINT_PARSER_PACKAGE_PATH = require.resolve('astro-eslint-parser/package.json', {
  paths: [resolve(PACKAGE_ROOT, '../astro-doctor')],
})

const ASTRO_ESLINT_PARSER_PATH = resolve(
  dirname(ASTRO_ESLINT_PARSER_PACKAGE_PATH),
  'lib/index.mjs',
)

const ASTRO_COMPILER_WASI_PACKAGE_PATH = require.resolve(
  '@astrojs/compiler-binding-wasm32-wasi/package.json',
)

const ASTRO_COMPILER_WASI_PATH = resolve(
  dirname(ASTRO_COMPILER_WASI_PACKAGE_PATH),
  'astro.wasm32-wasi.wasm',
)

const ASTRO_COMPILER_WASI_ENTRY_PATH = resolve(
  dirname(ASTRO_COMPILER_WASI_PACKAGE_PATH),
  'astro.wasi.cjs',
)

const ASTRO_COMPILER_WASI_WORKER_PATH = resolve(
  dirname(ASTRO_COMPILER_WASI_PACKAGE_PATH),
  'wasi-worker.mjs',
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
      alias: {
        '@astrojs/compiler-binding': ASTRO_COMPILER_WASI_ENTRY_PATH,
        'astro-eslint-parser': ASTRO_ESLINT_PARSER_PATH,
      },
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
  ])

  copyFileSync(ASTRO_COMPILER_WASI_PATH, resolve(DIST_PATH, 'astro.wasm32-wasi.wasm'))

  copyFileSync(ASTRO_COMPILER_WASI_WORKER_PATH, resolve(DIST_PATH, 'wasi-worker.mjs'))
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)

  process.exitCode = 1
})
