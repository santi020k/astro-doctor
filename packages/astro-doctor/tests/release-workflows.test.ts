import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

import { parseYAML } from 'confbox'
import { describe, expect, test } from 'vitest'

import { isPlainObject } from '../src/utils/is-plain-object.js'

import { GIT_WORKFLOW_TEST_TIMEOUT_MS } from './constants.js'

const getRecord = (value: unknown): Record<string, unknown> => {
  if (!isPlainObject(value)) throw new Error('Expected a workflow mapping')

  return value
}

const getString = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Expected a workflow string')

  return value
}

const evaluateCondition = (condition: string, context: Readonly<Record<string, unknown>>): unknown => runInNewContext(
  condition, { cancelled: () => false, ...context }
)

const getJob = (workflow: Record<string, unknown>): Record<string, unknown> => {
  const jobs = getRecord(workflow.jobs)

  return getRecord(jobs.release ?? jobs['build-and-deploy'])
}

const getScopeScript = (job: Record<string, unknown>): string => {
  if (!Array.isArray(job.steps)) throw new Error('Expected workflow steps')

  const step: unknown = job.steps.find((candidate: unknown) => isPlainObject(candidate) && candidate.id === 'scope')

  return getString(getRecord(step).run)
}

describe.each(['publish', 'deploy-docs'])('%s workflow', workflowName => {
  const workflow = getRecord(parseYAML(readFileSync(
    resolve(import.meta.dirname, `../../../.github/workflows/${workflowName}.yml`), 'utf8'
  )))
  const job = getJob(workflow)

  test('starts automatically only after CI completes', () => {
    const triggers = getRecord(workflow.on)

    expect(triggers).not.toHaveProperty('push')
    expect(getRecord(triggers.workflow_run)).toMatchObject({
      workflows: ['CI'], types: ['completed'], branches: ['main']
    })
    expect(job.needs).toBe('preflight')
  })

  test.each([
    { event: 'push', conclusion: 'success', branch: 'main', repository: 'owner/repo', expected: true },
    { event: 'push', conclusion: 'failure', branch: 'main', repository: 'owner/repo', expected: false },
    { event: 'push', conclusion: 'cancelled', branch: 'main', repository: 'owner/repo', expected: false },
    { event: 'pull_request', conclusion: 'success', branch: 'main', repository: 'owner/repo', expected: false },
    { event: 'push', conclusion: 'success', branch: 'feature/change', repository: 'owner/repo', expected: false },
    { event: 'push', conclusion: 'success', branch: 'main', repository: 'fork/repo', expected: false }
  ])('gates completed runs by event, repository, branch, and result: %j', scenario => {
    expect(evaluateCondition(getString(job.if), {
      github: {
        ref: 'refs/heads/main',
        event_name: 'workflow_run',
        repository: 'owner/repo',
        event: { workflow_run: {
          event: scenario.event,
          conclusion: scenario.conclusion,
          head_branch: scenario.branch,
          head_repository: { full_name: scenario.repository }
        } }
      },
      needs: { preflight: { result: 'skipped' } }
    })).toBe(scenario.expected)
  })

  test.each(['success', 'failure', 'cancelled', 'skipped'])('requires successful manual preflight: %s', result => {
    expect(evaluateCondition(getString(job.if), {
      github: { ref: 'refs/heads/main', event_name: 'workflow_dispatch' },
      needs: { preflight: { result } }
    })).toBe(result === 'success')
  })

  test('does not mutate external state when its own run is cancelled', () => {
    expect(evaluateCondition(getString(job.if), {
      cancelled: () => true,
      github: { ref: 'refs/heads/main', event_name: 'workflow_dispatch' },
      needs: { preflight: { result: 'success' } }
    })).toBe(false)
  })

  test('manual preflight reuses CI and is limited to main', () => {
    const preflight = getRecord(getRecord(workflow.jobs).preflight)

    expect(preflight.uses).toBe('./.github/workflows/ci.yml')
    expect(evaluateCondition(getString(preflight.if), {
      github: { ref: 'refs/heads/main', event_name: 'workflow_dispatch' }
    })).toBe(true)
    expect(evaluateCondition(getString(preflight.if), {
      github: { ref: 'refs/heads/feature/change', event_name: 'workflow_dispatch' }
    })).toBe(false)
    expect(evaluateCondition(getString(preflight.if), {
      github: { ref: 'refs/heads/main', event_name: 'workflow_run' }
    })).toBe(false)
  })

  test('checks out the validated SHA', () => {
    const environment = getRecord(job.env)

    expect(environment.VALIDATED_COMMIT).toBe('${{ github.event.workflow_run.head_sha || github.sha }}')
    expect(environment.WORKFLOW_COMMIT).toBe('${{ github.sha }}')
    if (!Array.isArray(job.steps)) throw new Error('Expected steps')

    const checkout: unknown = job.steps.find((step: unknown) => isPlainObject(step) && typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'))

    expect(getRecord(getRecord(checkout).with).ref).toBe('${{ env.VALIDATED_COMMIT }}')
  })

  test.each(['current', 'superseded', 'wrong-checkout', 'wrong-context', 'advanced-after-gate'])(
    'verifies commit identity before privileged operations: %s', scenario => {
      const testDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-workflow-'))

      try {
        execFileSync('git', ['init', '--initial-branch=main'], { cwd: testDirectory })
        execFileSync('git', ['config', 'user.email', 'astro-doctor@example.com'], { cwd: testDirectory })
        execFileSync('git', ['config', 'user.name', 'Astro Doctor'], { cwd: testDirectory })
        mkdirSync(join(testDirectory, 'scripts'))
        writeFileSync(join(testDirectory, 'scripts/check-validated-commit.sh'), readFileSync(
          resolve(import.meta.dirname, '../../../scripts/check-validated-commit.sh'), 'utf8'
        ))
        writeFileSync(join(testDirectory, 'source.txt'), 'first')
        execFileSync('git', ['add', '.'], { cwd: testDirectory })
        execFileSync('git', ['commit', '-m', 'first'], { cwd: testDirectory })

        const firstCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: testDirectory, encoding: 'utf8'
        }).trim()

        writeFileSync(join(testDirectory, 'source.txt'), 'second')
        execFileSync('git', ['commit', '-am', 'second'], { cwd: testDirectory })

        const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: testDirectory, encoding: 'utf8'
        }).trim()

        execFileSync('git', ['remote', 'add', 'origin', testDirectory], { cwd: testDirectory })
        if (scenario === 'superseded') execFileSync('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', firstCommit], { cwd: testDirectory })

        if (scenario === 'advanced-after-gate') {
          execFileSync('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', firstCommit], { cwd: testDirectory })
          execFileSync('git', ['update-ref', 'refs/heads/main', firstCommit], { cwd: testDirectory })
        }

        const outputPath = join(testDirectory, 'output')

        writeFileSync(outputPath, '')
        let result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', getScopeScript(job)], {
          cwd: testDirectory,
          encoding: 'utf8',
          env: {
            ...process.env,
            GITHUB_OUTPUT: outputPath,
            VALIDATED_COMMIT: new Set(['superseded', 'wrong-checkout', 'advanced-after-gate']).has(scenario) ?
              firstCommit :
              currentCommit,
            WORKFLOW_COMMIT: new Set(['wrong-context', 'advanced-after-gate']).has(scenario) ? firstCommit : currentCommit
          }
        })

        if (scenario === 'advanced-after-gate') {
          execFileSync('git', ['update-ref', 'refs/heads/main', currentCommit], { cwd: testDirectory })
          const guardedMutation = 'bash scripts/check-validated-commit.sh --require-current && touch external-mutation'

          result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', guardedMutation], {
            cwd: testDirectory,
            encoding: 'utf8',
            env: {
              ...process.env,
              GITHUB_OUTPUT: outputPath,
              VALIDATED_COMMIT: firstCommit,
              WORKFLOW_COMMIT: firstCommit
            }
          })
        }

        expect(existsSync(join(testDirectory, 'external-mutation'))).toBe(false)
        expect(result.status).toBe(new Set(['wrong-checkout', 'advanced-after-gate']).has(scenario) ? 1 : 0)
        expect(readFileSync(outputPath, 'utf8').trim()).toBe(
          scenario === 'wrong-checkout' ? '' : `relevant=${new Set(['current', 'advanced-after-gate']).has(scenario)}`
        )
      } finally {
        rmSync(testDirectory, { recursive: true, force: true })
      }
    }, GIT_WORKFLOW_TEST_TIMEOUT_MS
  )
})

const locateGitExecutable = (): string => execFileSync(
  process.platform === 'win32' ? 'where' : 'which', ['git'], { encoding: 'utf8' }
).trim().split(/\r?\n/u)[0] ?? 'git'

describe('guarded package release metadata', () => {
  test.each(['current', 'advance-before-tag', 'advance-before-release'])(
    'blocks stale tag and GitHub release mutations: %s', scenario => {
      const directory = mkdtempSync(join(tmpdir(), 'astro-doctor-release-metadata-'))

      try {
        mkdirSync(join(directory, 'scripts'))
        mkdirSync(join(directory, 'packages', 'example'), { recursive: true })
        mkdirSync(join(directory, 'bin'))
        writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module', private: true }))
        writeFileSync(join(directory, 'packages/example/package.json'), JSON.stringify({ name: '@fixture/example', version: '0.0.1' }))
        writeFileSync(join(directory, 'packages/example/CHANGELOG.md'), '# Changelog\n\n## 0.0.1\n\nFixture release notes.\n\n## 0.0.0\n\nOld notes.\n')
        for (const name of ['publish-packages.mjs', 'constants.ts', 'check-validated-commit.sh']) {
          writeFileSync(join(directory, 'scripts', name), readFileSync(resolve(import.meta.dirname, '../../../scripts', name)))
        }
        execFileSync('git', ['init', '--initial-branch=main'], { cwd: directory })
        execFileSync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: directory })
        execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd: directory })
        execFileSync('git', ['add', '.'], { cwd: directory })
        execFileSync('git', ['commit', '-m', 'first'], { cwd: directory })
        const first = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim()

        writeFileSync(join(directory, 'changed.txt'), 'next main')
        execFileSync('git', ['add', '.'], { cwd: directory })
        execFileSync('git', ['commit', '-m', 'second'], { cwd: directory })
        const second = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim()
        const realGit = locateGitExecutable()

        execFileSync('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', first], { cwd: directory })
        execFileSync('git', ['update-ref', 'refs/heads/main', first], { cwd: directory })
        execFileSync('git', ['remote', 'add', 'origin', directory], { cwd: directory })
        writeFileSync(join(directory, 'bin/git'), [
          '#!/bin/sh',
          'if [ "$1" = "push" ]; then',
          '  touch tag-push',
          '  if [ "$RELEASE_SCENARIO" = "advance-before-release" ]; then',
          '    "$REAL_GIT" update-ref refs/heads/main "$NEXT_MAIN"',
          '  fi',
          '  exit 0',
          'fi',
          'exec "$REAL_GIT" "$@"'
        ].join('\n'))
        chmodSync(join(directory, 'bin/git'), 0o755)
        writeFileSync(join(directory, 'bootstrap.mjs'), `
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
globalThis.fetch = async (url, options = {}) => {
  if (String(url).startsWith('https://registry.npmjs.org/')) return new Response('{}');
  if (options.method === 'POST') {
    writeFileSync('release-post', options.body);
    return new Response('{}', { status: 201 });
  }
  if (process.env.RELEASE_SCENARIO === 'advance-before-tag') {
    execFileSync(process.env.REAL_GIT, ['update-ref', 'refs/heads/main', process.env.NEXT_MAIN]);
  }
  return new Response('{}', { status: 404 });
};
await import('./scripts/publish-packages.mjs');
`)
        const result = spawnSync(process.execPath, ['bootstrap.mjs'], {
          cwd: directory,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${join(directory, 'bin')}:${process.env.PATH ?? ''}`,
            REAL_GIT: realGit,
            NEXT_MAIN: second,
            RELEASE_SCENARIO: scenario,
            GITHUB_ACTIONS: 'true',
            GITHUB_REPOSITORY: 'fixture/example',
            GITHUB_TOKEN: 'fixture-token',
            VALIDATED_COMMIT: first,
            WORKFLOW_COMMIT: first,
            CHANGESETS_OUTPUT: join(directory, 'events')
          }
        })

        const releasePath = join(directory, 'release-post')
        const releaseBody = existsSync(releasePath) ?
          JSON.parse(readFileSync(releasePath, 'utf8')) as { body: string, target_commitish: string } :
          undefined

        expect(releaseBody?.body).toBe(scenario === 'current' ? 'Fixture release notes.' : undefined)
        expect(releaseBody?.target_commitish).toBe(scenario === 'current' ? first : undefined)
        expect(result.status).toBe(scenario === 'current' ? 0 : 1)
        expect(existsSync(join(directory, 'tag-push'))).toBe(scenario !== 'advance-before-tag')
        expect(existsSync(join(directory, 'release-post'))).toBe(scenario === 'current')
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    }, GIT_WORKFLOW_TEST_TIMEOUT_MS
  )
})
