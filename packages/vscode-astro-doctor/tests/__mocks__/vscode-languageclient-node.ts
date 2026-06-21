import { vi } from 'vitest'

export const TransportKind = {
  ipc: 0,
  pipe: 1,
  socket: 2,
  stdio: 3,
} as const

export const LanguageClient = vi.fn().mockImplementation(() => ({
  dispose: vi.fn(),
  onNotification: vi.fn(),
  registerFeature: vi.fn(),
  restart: vi.fn(),
  sendRequest: vi.fn(),
  start: vi.fn().mockResolvedValue(),
  stop: vi.fn().mockResolvedValue(),
}))
