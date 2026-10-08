import { existsSync, rmSync } from 'node:fs'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { scanBaseline } from '../src/baseline.js'
import { extractRevision } from '../src/git.js'

vi.mock('../src/git.js', () => ({ extractRevision: vi.fn() }))

let snapshotDirectory = ''

afterEach(() => {
  if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true })
  snapshotDirectory = ''
  vi.clearAllMocks()
})

describe('baseline snapshot cleanup', () => {
  test('removes the snapshot if revision extraction fails', async () => {
    vi.mocked(extractRevision).mockImplementationOnce((_directory, _revision, destinationDirectory) => {
      snapshotDirectory = destinationDirectory
      throw new Error('Revision extraction failed')
    })

    await expect(scanBaseline({
      repositoryDirectory: '/project',
      projectDirectory: '/project',
      files: [],
      baseRevision: 'missing',
      scanOptions: {}
    })).rejects.toThrow('Revision extraction failed')

    expect(snapshotDirectory).not.toBe('')
    expect(existsSync(snapshotDirectory)).toBe(false)
  })
})
