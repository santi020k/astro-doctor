import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  test.each(['current', 'superseded', 'wrong-checkout', 'wrong-context'])(
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

        const outputPath = join(testDirectory, 'output')

        writeFileSync(outputPath, '')
        const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', getScopeScript(job)], {
          cwd: testDirectory,
          encoding: 'utf8',
          env: {
            ...process.env,
            GITHUB_OUTPUT: outputPath,
            VALIDATED_COMMIT: scenario === 'superseded' || scenario === 'wrong-checkout' ? firstCommit : currentCommit,
            WORKFLOW_COMMIT: scenario === 'wrong-context' ? firstCommit : currentCommit
          }
        })

        expect(result.status).toBe(scenario === 'wrong-checkout' ? 1 : 0)
        expect(readFileSync(outputPath, 'utf8').trim()).toBe(
          scenario === 'wrong-checkout' ? '' : `relevant=${scenario === 'current'}`
        )
      } finally {
        rmSync(testDirectory, { recursive: true, force: true })
      }
    }, GIT_WORKFLOW_TEST_TIMEOUT_MS
  )
})
