import { vi } from 'vitest'

export const TransportKind = {
  ipc: 0,
  pipe: 1,
  socket: 2,
  stdio: 3,
} as const

export const LanguageClient = vi.fn(class {
  public readonly dispose = vi.fn()
  public readonly onNotification = vi.fn(() => ({
    dispose: vi.fn(),
  }))

  public readonly registerFeature = vi.fn()
  public readonly restart = vi.fn()
  public readonly sendRequest = vi.fn()
  public readonly start = vi.fn().mockResolvedValue()
  public readonly stop = vi.fn().mockResolvedValue()
})
