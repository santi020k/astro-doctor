import { execFile } from 'node:child_process'

import { afterEach, describe, expect, test, vi } from 'vitest'
import type * as vscode from 'vscode'

import { resolveNodeCommand } from '../src/utils/resolve-node-command'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

const makeMockConfig = (nodePath = '') => ({
  get: vi.fn((_key: string, defaultValue?: unknown) => nodePath || defaultValue),
})

const makeMockOutputChannel = () => ({
  appendLine: vi.fn(),
})

const execFileMock = vi.mocked(execFile)

describe('resolveNodeCommand', () => {
  const originalShell = process.env.SHELL

  afterEach(() => {
    process.env.SHELL = originalShell
    execFileMock.mockReset()
  })

  test('uses the configured Node.js path', async () => {
    const configuration = makeMockConfig('/custom/node')
    const outputChannel = makeMockOutputChannel()

    const result = await resolveNodeCommand(
      configuration as unknown as vscode.WorkspaceConfiguration,
      outputChannel as unknown as vscode.OutputChannel,
    )

    expect(result).toBe('/custom/node')
    expect(execFileMock).not.toHaveBeenCalled()
  })

  test('resolves Node.js through the user shell', async () => {
    process.env.SHELL = '/bin/zsh'
    execFileMock.mockImplementation((_file, _arguments, _options, callback) => {
      callback(null, 'shell startup output\n/Users/example/.nvm/versions/node/v22.23.1/bin/node\n', '')

      return execFileMock
    })

    const configuration = makeMockConfig()
    const outputChannel = makeMockOutputChannel()

    const result = await resolveNodeCommand(
      configuration as unknown as vscode.WorkspaceConfiguration,
      outputChannel as unknown as vscode.OutputChannel,
    )

    expect(result).toBe('/Users/example/.nvm/versions/node/v22.23.1/bin/node')
    expect(outputChannel.appendLine).toHaveBeenCalledWith(
      'Astro Doctor: resolved Node.js runtime at /Users/example/.nvm/versions/node/v22.23.1/bin/node',
    )
  })

  test('falls back to node when shell resolution fails', async () => {
    process.env.SHELL = '/bin/zsh'
    execFileMock.mockImplementation((_file, _arguments, _options, callback) => {
      callback(new Error('missing'), '', '')

      return execFileMock
    })

    const result = await resolveNodeCommand(
      makeMockConfig() as unknown as vscode.WorkspaceConfiguration,
      makeMockOutputChannel() as unknown as vscode.OutputChannel,
    )

    expect(result).toBe('node')
  })
})
