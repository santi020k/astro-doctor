import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

const quality = process.env.QUALITY_BINARY || 'quality'

test('published Quality plans package consumers and conservative fallbacks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astro-impact-'))
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
  const git = (...arguments_) => execFileSync('git', arguments_, { cwd: directory, env: environment, stdio: 'pipe' }).toString().trim()

  const change = path => {
    mkdirSync(dirname(join(directory, path)), { recursive: true })

    writeFileSync(join(directory, path), 'fixture\n')

    git('add', '.')

    git('commit', '-qm', 'fixture')
  }

  const plan = base => JSON.parse(execFileSync(quality, ['impact', 'plan', '--base', base, '--format', 'json'], { cwd: directory, env: environment, encoding: 'utf8' }))

  try {
    git('init', '-q')

    git('config', 'user.name', 'Fixture')

    git('config', 'user.email', 'fixture@example.test')

    copyFileSync(new URL('../quality-impact.json', import.meta.url), join(directory, 'quality-impact.json'))

    change('README.md')

    let base = git('rev-parse', 'HEAD')

    change('packages/astro-doctor/src/example.ts')

    const selected = plan(base)

    assert.equal(selected.mode, 'affected')

    assert.deepEqual(selected.selected.map(node => node.id), ['cli', 'docs', 'extension', 'oxlint', 'plugin'])

    base = git('rev-parse', 'HEAD')

    change('pnpm-lock.yaml')

    assert.equal(plan(base).mode, 'full')

    base = git('rev-parse', 'HEAD')

    change('unknown/input')

    assert.equal(plan(base).mode, 'full')

    assert.equal(plan('missing-history').mode, 'full')

    base = git('rev-parse', 'HEAD')

    git('rm', 'packages/astro-doctor/src/example.ts')

    git('commit', '-qm', 'delete')

    assert.ok(plan(base).selected.some(node => node.id === 'extension'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
