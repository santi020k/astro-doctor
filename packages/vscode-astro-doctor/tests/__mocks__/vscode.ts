import { vi } from 'vitest'

export const ExtensionMode = {
  Development: 1,
  Production: 2,
  Test: 3,
} as const

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
} as const

export const Uri = {
  parse: vi.fn((value: string) => ({ toString: () => value })),
}

export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
  })),
  workspaceFolders: [] as { uri: { fsPath: string } }[],
}

export const window = {
  activeTextEditor: undefined as undefined | { document: { uri: { toString: () => string } } },
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    dispose: vi.fn(),
    show: vi.fn(),
  })),
  createStatusBarItem: vi.fn(() => ({
    command: '',
    dispose: vi.fn(),
    show: vi.fn(),
    text: '',
    tooltip: '',
  })),
  registerWebviewViewProvider: vi.fn(),
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
}

export const commands = {
  registerCommand: vi.fn(),
}

export const env = {
  openExternal: vi.fn(),
}
