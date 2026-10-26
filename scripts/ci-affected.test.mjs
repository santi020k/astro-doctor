import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { changedFiles, createPlan, gitEnvironment, requiresFullValidation } from './ci-affected.mjs'

const workspaces = [{ name: 'docs', directory: 'apps/docs' }, { name: 'cli', directory: 'packages/cli' }]
const input = { event: 'pull_request', headRef: 'ci/example', files: ['apps/docs/src/index.astro'], workspaces }

test('ordinary workspace edits can use affected validation', () => {
  assert.equal(requiresFullValidation(input), false)

  assert.equal(requiresFullValidation({ ...input, files: ['packages/cli/index.ts', '.changeset/package-fix.md'] }), false)

  assert.equal(requiresFullValidation({ ...input, files: ['.changeset/package-fix.md'] }), false)
})

test('release, push, manual, shared, unknown and dependency changes retain full validation', () => {
  for (const override of [
    { full: true }, { event: 'push' }, { event: 'workflow_dispatch' },
    { headRef: 'release/v1.6.0' }, { headRef: 'changeset-release/main' },
    ...['pnpm-lock.yaml', 'turbo.json', '.changeset/config.json', '.changeset/nested/note.md', 'scripts/check.mjs', '.github/workflows/ci.yml', 'new-area/file.ts', 'packages/cli/package.json', 'packages/cli/CHANGELOG.md'].map(file => ({ files: [file] })),
  ]) assert.equal(requiresFullValidation({ ...input, ...override }), true)
})

test('missing Git history fails safely to the complete command set', () => {
  const plan = createPlan({ base: 'missing-ref', env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'ci/example', npm_execpath: '/unavailable' } })

  assert.equal(plan.mode, 'full')

  assert.equal(plan.docs, true)

  assert.equal(plan.packages, true)

  assert.ok(plan.commands.some(command => command.includes('test:coverage')))

  assert.ok(plan.commands.some(command => command.includes('check:packed-install')))
})

test('Git selection includes deletions, rename sides, staged, unstaged and untracked files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astro-ci-scope-'))
  const git = (...arguments_) => execFileSync('git', arguments_, { cwd: directory, env: gitEnvironment(), stdio: 'pipe' })

  try {
    git('init', '--quiet')

    git('config', 'user.name', 'CI fixture')

    git('config', 'user.email', 'ci@example.test')

    mkdirSync(join(directory, 'packages'))

    for (const name of ['deleted', 'renamed', 'staged', 'unstaged']) writeFileSync(join(directory, 'packages', name), 'before\n')

    git('add', '.')

    git('commit', '-m', 'fixture')

    git('rm', 'packages/deleted')

    git('mv', 'packages/renamed', 'packages/moved')

    writeFileSync(join(directory, 'packages/staged'), 'after\n')

    git('add', 'packages/staged')

    writeFileSync(join(directory, 'packages/unstaged'), 'after\n')

    writeFileSync(join(directory, 'packages/untracked'), 'new\n')

    assert.deepEqual(changedFiles(directory, 'HEAD').files, ['packages/deleted', 'packages/moved', 'packages/renamed', 'packages/staged', 'packages/unstaged', 'packages/untracked'])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})


test('validated Turbo selection controls consumers and rejects incomplete graphs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'astro-ci-graph-'))
  const git = (...arguments_) => execFileSync('git', arguments_, { cwd: directory, env: gitEnvironment(), stdio: 'pipe' })
  const packageManager = join(directory, 'pnpm.cjs')
  const cli = '@santi020k/astro-doctor'
  const docs = '@santi020k/astro-doctor-docs'
  const environment = { ...gitEnvironment(), GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'ci/example', npm_execpath: packageManager }

  try {
    git('init', '--quiet')

    git('config', 'user.name', 'CI fixture')

    git('config', 'user.email', 'ci@example.test')

    mkdirSync(join(directory, 'apps/docs'), { recursive: true })

    writeFileSync(join(directory, 'apps/docs/page.astro'), 'before')

    writeFileSync(packageManager, `const args = process.argv.slice(2); process.stdout.write(args[0] === 'list' ? JSON.stringify([{name: '${docs}', path: process.cwd() + '/apps/docs'}, {name: '${cli}', path: process.cwd() + '/packages/cli'}]) : process.env.TEST_GRAPH);`)

    git('add', '.')

    git('commit', '-m', 'fixture')

    writeFileSync(join(directory, 'apps/docs/page.astro'), 'after')

    const planFor = graph => createPlan({ cwd: directory, base: 'HEAD', env: { ...environment, TEST_GRAPH: graph } })

    assert.equal(planFor(JSON.stringify({ packages: ['//', docs] })).mode, 'full')

    mkdirSync(join(directory, '.changeset'))

    writeFileSync(join(directory, '.changeset/package-fix.md'), '---\n"@santi020k/astro-doctor": patch\n---\nRelease note.\n')

    const docsPlan = planFor(JSON.stringify({ packages: ['//', docs] }))

    assert.equal(docsPlan.mode, 'affected')

    assert.equal(docsPlan.docs, true)

    assert.equal(docsPlan.packages, false)

    assert.deepEqual(docsPlan.selected, [docs])

    assert.ok(docsPlan.commands[0].includes('--filter=@santi020k/astro-doctor...'))

    assert.equal(docsPlan.commands.some(command => command.includes('check:packed-install')), false)

    const consumers = planFor(JSON.stringify({ packages: [docs, cli] }))

    assert.ok(consumers.commands.some(command => command.includes('check:packed-install')))

    for (const graph of ['invalid', '{}', '{"packages":[]}', '{"packages":["unknown"]}']) {
      assert.equal(planFor(graph).mode, 'full')
    }

    writeFileSync(join(directory, 'apps/docs/page.astro'), 'before')

    const notePlan = planFor(JSON.stringify({ packages: ['//'] }))

    assert.equal(notePlan.mode, 'affected')

    assert.deepEqual(notePlan.selected, [])

    assert.equal(notePlan.docs, false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})


test('foreign Git fixtures ignore inherited repository overrides', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ci-poisoned-git-'))
  const git = (...arguments_) => execFileSync('git', arguments_, { cwd: directory, env: gitEnvironment(), stdio: 'pipe' })
  const original = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('GIT_')))

  try {
    Object.assign(process.env, { GIT_DIR: '/missing/foreign.git', GIT_WORK_TREE: '/missing/worktree', GIT_INDEX_FILE: '/missing/index', GIT_COMMON_DIR: '/missing/common', GIT_OBJECT_DIRECTORY: '/missing/objects' })

    git('init', '--quiet')

    git('config', 'user.name', 'CI fixture')

    git('config', 'user.email', 'ci@example.test')

    writeFileSync(join(directory, 'example.txt'), 'before')

    git('add', '.')

    git('commit', '-m', 'fixture')

    writeFileSync(join(directory, 'example.txt'), 'after')

    assert.deepEqual(changedFiles(directory, 'HEAD').files, ['example.txt'])
  } finally {
    for (const key of Object.keys(process.env).filter(key => key.startsWith('GIT_'))) delete process.env[key]

    Object.assign(process.env, original)

    rmSync(directory, { recursive: true, force: true })
  }
})
