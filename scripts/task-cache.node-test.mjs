import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { gitEnvironment } from './ci-affected.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const turbo = join(dirname(require.resolve('turbo/package.json')), 'bin/turbo')

test('shared compiler, lint and export inputs invalidate actual Turbo task hashes', context => {
  const directory = mkdtempSync(join(tmpdir(), 'astro-task-cache-'))
  const environment = gitEnvironment()

  context.after(() => rmSync(directory, { recursive: true, force: true }))

  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, env: environment, encoding: 'utf8' }).split('\0').filter(Boolean)

  for (const file of tracked) {
    if (!lstatSync(join(root, file)).isFile()) continue

    mkdirSync(dirname(join(directory, file)), { recursive: true })

    copyFileSync(join(root, file), join(directory, file))
  }

  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')

  execFileSync('git', ['init', '--quiet'], { cwd: directory, env: environment })

  const hashes = () => {
    const output = execFileSync(process.execPath, [turbo, 'run', 'build', 'typecheck', 'lint', 'check:exports', '--dry=json'], {
      cwd: directory,
      env: environment,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })

    const { tasks } = JSON.parse(output)

    assert.ok(Array.isArray(tasks) && tasks.length > 0)

    return new Map(tasks.map(task => [task.taskId, task.hash]))
  }

  const before = hashes()
  const packageName = '@santi020k/eslint-plugin-astro-doctor'

  const inputs = [
    ['tsconfig.base.json', ['build', 'typecheck']],
    ['tsconfig.eslint.json', ['lint']],
    ['eslint.config.js', ['lint']],
    ['scripts/check-package-exports.mjs', ['check:exports']],
  ]

  for (const [file, tasks] of inputs) {
    const path = join(directory, file)
    const original = readFileSync(path, 'utf8')

    writeFileSync(path, `${original}\n`)

    const after = hashes()

    for (const task of tasks) {
      const identifier = `${packageName}#${task}`

      assert.ok(before.has(identifier), `Missing fixture task ${identifier}`)

      assert.notEqual(after.get(identifier), before.get(identifier), `${file} must invalidate ${identifier}`)
    }

    writeFileSync(path, original)
  }

  const readme = join(directory, 'README.md')

  writeFileSync(readme, `${readFileSync(readme, 'utf8')}\nUnrelated documentation fixture.\n`)

  assert.deepEqual(hashes(), before)
})
