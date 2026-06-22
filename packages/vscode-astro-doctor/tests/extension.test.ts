import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as vscode from 'vscode'

import {
  createServerOptions,
  createServerStatusFeature,
  renderStatus,
  resolveBundledServer,
  resolveConfiguredServer,
  resolveDevelopmentServer,
  resolveRuntime,
  resolveWorkspaceServer,
} from '../src/extension'

const ENV_LOCAL = 'local'
const ENV_PRODUCTION = 'production'
const EMPTY_FILE_SIZE_BYTES = 0
const VSCODE_FILE_TYPE_FILE = 1

const createMockFileStat = () => ({
  ctime: Date.now(),
  mtime: Date.now(),
  size: EMPTY_FILE_SIZE_BYTES,
  type: VSCODE_FILE_TYPE_FILE,
})

const workspaceFileSystem = vi.mocked(vscode.workspace.fs)

const mockExistingWorkspaceFile = () => {
  workspaceFileSystem.stat.mockResolvedValue(createMockFileStat())
}

const mockMissingWorkspaceFile = () => {
  workspaceFileSystem.stat.mockRejectedValue(new Error('missing'))
}

const resetWorkspaceFileSystemMock = () => {
  workspaceFileSystem.stat.mockReset()
}

const makeMockConfig = (overrides: Record<string, unknown> = {}) => {
  const overridesMap = new Map(Object.entries(overrides))
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => overridesMap.get(key) ?? defaultValue),
  }
}

const makeMockStatusBarItem = () => ({
  command: '',
  dispose: vi.fn(),
  show: vi.fn(),
  text: '',
  tooltip: '',
})

const makeMockOutputChannel = () => ({
  appendLine: vi.fn(),
  dispose: vi.fn(),
  show: vi.fn(),
})

const makeMockContext = (mode: number) =>
  ({ extensionMode: mode, extensionPath: '/ext' }) as unknown as vscode.ExtensionContext

describe('resolveRuntime', () => {
  afterEach(() => {
    delete process.env.ASTRO_DOCTOR_EXTENSION_ENV
  })

  test('returns local runtime when env var is set to local', () => {
    process.env.ASTRO_DOCTOR_EXTENSION_ENV = ENV_LOCAL

    const result = resolveRuntime(makeMockContext(vscode.ExtensionMode.Production))

    expect(result).toEqual({ environment: ENV_LOCAL, preferWorkspaceServer: true })
  })

  test('returns production runtime when env var is set to production', () => {
    process.env.ASTRO_DOCTOR_EXTENSION_ENV = ENV_PRODUCTION

    const result = resolveRuntime(makeMockContext(vscode.ExtensionMode.Development))

    expect(result).toEqual({ environment: ENV_PRODUCTION, preferWorkspaceServer: false })
  })

  test('returns local runtime when extension mode is Development', () => {
    const result = resolveRuntime(makeMockContext(vscode.ExtensionMode.Development))

    expect(result).toEqual({ environment: ENV_LOCAL, preferWorkspaceServer: true })
  })

  test('returns production runtime when extension mode is Production', () => {
    const result = resolveRuntime(makeMockContext(vscode.ExtensionMode.Production))

    expect(result).toEqual({ environment: ENV_PRODUCTION, preferWorkspaceServer: false })
  })

  test('trims whitespace from the env var', () => {
    process.env.ASTRO_DOCTOR_EXTENSION_ENV = '  local  '

    const result = resolveRuntime(makeMockContext(vscode.ExtensionMode.Production))

    expect(result.environment).toBe(ENV_LOCAL)
  })
})

describe('resolveConfiguredServer', () => {
  test('returns a ResolvedServer when serverPath is set', () => {
    const config = makeMockConfig({ serverPath: '/usr/local/bin/astro-doctor' })

    const result = resolveConfiguredServer(config as unknown as vscode.WorkspaceConfiguration)

    expect(result).toEqual({
      args: ['experimental-lsp'],
      command: '/usr/local/bin/astro-doctor',
      shell: false,
    })
  })

  test('returns undefined when serverPath is empty', () => {
    const config = makeMockConfig({ serverPath: '' })

    const result = resolveConfiguredServer(config as unknown as vscode.WorkspaceConfiguration)

    expect(result).toBeUndefined()
  })

  test('returns undefined when serverPath is only whitespace', () => {
    const config = makeMockConfig({ serverPath: '   ' })

    const result = resolveConfiguredServer(config as unknown as vscode.WorkspaceConfiguration)

    expect(result).toBeUndefined()
  })
})

describe('resolveDevelopmentServer', () => {
  afterEach(() => {
    resetWorkspaceFileSystemMock()
  })

  test('returns a ResolvedServer when the development build exists', async () => {
    mockExistingWorkspaceFile()

    const result = await resolveDevelopmentServer('/workspace/packages/vscode-astro-doctor')

    expect(result).toMatchObject({
      args: expect.arrayContaining(['experimental-lsp']) as unknown[],
      command: process.execPath,
      shell: false,
    })

    const expectedPath = path.join(
      '/workspace/packages/vscode-astro-doctor',
      '..',
      'astro-doctor',
      'dist',
      'bin',
      'astro-doctor.js',
    )

    expect(result?.args[0]).toBe(expectedPath)
  })

  test('returns undefined when the development build does not exist', async () => {
    mockMissingWorkspaceFile()

    const result = await resolveDevelopmentServer('/workspace/packages/vscode-astro-doctor')

    expect(result).toBeUndefined()
  })
})

describe('resolveWorkspaceServer', () => {
  afterEach(() => {
    resetWorkspaceFileSystemMock()
    vscode.workspace.workspaceFolders = []
  })

  test('returns undefined when there are no workspace folders', async () => {
    vscode.workspace.workspaceFolders = []

    const result = await resolveWorkspaceServer()

    expect(result).toBeUndefined()
  })

  test('returns a ResolvedServer when a workspace bin is found', async () => {
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/my-project' } }]

    mockExistingWorkspaceFile()

    const result = await resolveWorkspaceServer()

    expect(result).toMatchObject({
      args: ['experimental-lsp'],
    })

    expect(result?.command).toContain('astro-doctor')
  })

  test('returns undefined when no workspace bin matches', async () => {
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/my-project' } }]

    mockMissingWorkspaceFile()

    const result = await resolveWorkspaceServer()

    expect(result).toBeUndefined()
  })
})

describe('resolveBundledServer', () => {
  afterEach(() => {
    resetWorkspaceFileSystemMock()
  })

  test('returns the bundled server path when it exists', async () => {
    mockExistingWorkspaceFile()

    const result = await resolveBundledServer('/ext')

    expect(result).toBe(path.join('/ext', 'dist', 'server.mjs'))
  })

  test('returns undefined when the bundled server does not exist', async () => {
    mockMissingWorkspaceFile()

    const result = await resolveBundledServer('/ext')

    expect(result).toBeUndefined()
  })
})

describe('createServerOptions', () => {
  beforeEach(() => {
    vscode.workspace.workspaceFolders = []
    delete process.env.ASTRO_DOCTOR_EXTENSION_ENV
  })

  afterEach(() => {
    resetWorkspaceFileSystemMock()
  })

  test('uses the explicit serverPath when configured', async () => {
    const config = makeMockConfig({ serverPath: '/custom/astro-doctor' })
    const runtime = { environment: ENV_PRODUCTION, preferWorkspaceServer: false }

    mockMissingWorkspaceFile()

    const outputChannel = makeMockOutputChannel()

    const result = await createServerOptions(
      config as unknown as vscode.WorkspaceConfiguration,
      '/ext',
      outputChannel as unknown as vscode.OutputChannel,
      runtime,
    )

    expect(result).toBeDefined()
    expect((result as { run: { command?: string } }).run).toMatchObject({ command: '/custom/astro-doctor' })
  })

  test('uses the bundled server in production when no workspace bin exists', async () => {
    const config = makeMockConfig({ serverPath: '' })
    const runtime = { environment: ENV_PRODUCTION, preferWorkspaceServer: false }

    workspaceFileSystem.stat.mockImplementation((uri) => {
      if (uri.fsPath.includes('server.mjs')) {
        return Promise.resolve(createMockFileStat())
      }

      return Promise.reject(new Error('missing'))
    })

    const outputChannel = makeMockOutputChannel()

    const result = await createServerOptions(
      config as unknown as vscode.WorkspaceConfiguration,
      '/ext',
      outputChannel as unknown as vscode.OutputChannel,
      runtime,
    )

    expect(result).toBeDefined()
    expect((result as { run: { module?: string } }).run).toMatchObject({
      module: path.join('/ext', 'dist', 'server.mjs'),
    })
  })

  test('returns undefined and logs when no server is found', async () => {
    const config = makeMockConfig({ serverPath: '' })
    const runtime = { environment: ENV_PRODUCTION, preferWorkspaceServer: false }

    mockMissingWorkspaceFile()

    const channel = makeMockOutputChannel()

    const result = await createServerOptions(
      config as unknown as vscode.WorkspaceConfiguration,
      '/ext',
      channel as unknown as vscode.OutputChannel,
      runtime,
    )

    expect(result).toBeUndefined()
    expect(channel.appendLine).toHaveBeenCalledOnce()
  })
})

describe('renderStatus', () => {
  test('sets spinning text when not quiescent', () => {
    const item = makeMockStatusBarItem()

    renderStatus(item as unknown as vscode.StatusBarItem, { health: 'ok', quiescent: false })

    expect(item.text).toBe('$(sync~spin) Astro Doctor')
    expect(item.tooltip).toBe('Astro Doctor: scanning…')
  })

  test('sets error icon when health is error and quiescent', () => {
    const item = makeMockStatusBarItem()

    renderStatus(item as unknown as vscode.StatusBarItem, {
      health: 'error',
      message: 'Something broke',
      quiescent: true,
    })

    expect(item.text).toBe('$(error) Astro Doctor')
    expect(item.tooltip).toBe('Something broke')
  })

  test('sets warning icon when health is warning and quiescent', () => {
    const item = makeMockStatusBarItem()

    renderStatus(item as unknown as vscode.StatusBarItem, { health: 'warning', quiescent: true })

    expect(item.text).toBe('$(warning) Astro Doctor')
    expect(item.tooltip).toBe('Astro Doctor: ready')
  })

  test('sets check icon when health is ok and quiescent', () => {
    const item = makeMockStatusBarItem()

    renderStatus(item as unknown as vscode.StatusBarItem, { health: 'ok', quiescent: true })

    expect(item.text).toBe('$(check) Astro Doctor')
    expect(item.tooltip).toBe('Astro Doctor: ready')
  })

  test('uses the provided message as tooltip', () => {
    const item = makeMockStatusBarItem()

    renderStatus(item as unknown as vscode.StatusBarItem, {
      health: 'ok',
      message: 'Custom tooltip',
      quiescent: true,
    })

    expect(item.tooltip).toBe('Custom tooltip')
  })
})

describe('createServerStatusFeature', () => {
  test('returns state kind static', () => {
    const feature = createServerStatusFeature()

    expect(feature.getState()).toEqual({ kind: 'static' })
  })

  test('sets serverStatusNotification capability', () => {
    const feature = createServerStatusFeature()
    const capabilities = {} as Parameters<typeof feature.fillClientCapabilities>[0]

    feature.fillClientCapabilities(capabilities)

    expect(
      (capabilities.experimental as Record<string, unknown>).serverStatusNotification,
    ).toBe(true)
  })

  test('merges into existing experimental capabilities', () => {
    const feature = createServerStatusFeature()
    const existing = { otherFlag: true }
    const capabilities = { experimental: existing } as Parameters<
      typeof feature.fillClientCapabilities
    >[0]

    feature.fillClientCapabilities(capabilities)

    expect(
      (capabilities.experimental as Record<string, unknown>).serverStatusNotification,
    ).toBe(true)

    expect(
      (capabilities.experimental as Record<string, unknown>).otherFlag,
    ).toBe(true)
  })
})
