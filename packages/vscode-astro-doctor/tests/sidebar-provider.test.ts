import { beforeEach, describe, expect, test,vi } from 'vitest'
import type * as vscode from 'vscode'

import {
  AstroDoctorSidebarProvider,
  buildSidebarHtml,
  type HealthScoreData,
  type TopIssueData,
} from '../src/sidebar-provider'

const makeHealthData = (overrides: Partial<HealthScoreData> = {}): HealthScoreData => ({
  errorCount: 0,
  fileCount: 5,
  score: 95,
  scoreBreakdown: {
    accessibility: 90,
    'best-practices': 85,
    performance: 100,
    security: 100,
  },
  scoreLabel: 'A',
  warningCount: 1,
  ...overrides,
})

const makeTopIssues = (): TopIssueData[] => [
  {
    category: 'performance',
    column: 1,
    filePath: '/src/pages/index.astro',
    line: 10,
    message: 'Use client:idle instead of client:load',
    ruleId: 'no-client-load-overuse',
    severity: 'warning',
  },
]

const makeWebviewView = () => {
  const postMessage = vi.fn<[unknown], Promise<boolean>>().mockResolvedValue(true)
  const onDidReceiveMessage = vi.fn()
  return {
    webview: {
      html: '',
      onDidReceiveMessage,
      options: {} as vscode.WebviewOptions,
      postMessage,
    },
  } as unknown as vscode.WebviewView
}

describe('buildSidebarHtml', () => {
  test('injects the nonce into the HTML output', () => {
    const nonce = 'testnonce123'
    const html = buildSidebarHtml(nonce)

    expect(html).toContain(`nonce="${nonce}"`)
  })

  test('contains a root element', () => {
    const html = buildSidebarHtml('abc')

    expect(html).toContain('id="root"')
  })

  test('includes a Content-Security-Policy meta tag', () => {
    const html = buildSidebarHtml('mynonce')

    expect(html).toContain('Content-Security-Policy')
  })

  test('includes the lang attribute on html element', () => {
    const html = buildSidebarHtml('x')

    expect(html).toContain('<html lang="en">')
  })

  test('uses the nonce for both style and script tags', () => {
    const nonce = 'uniquenonce'
    const html = buildSidebarHtml(nonce)
    const occurrences = html.split(nonce).length - 1

    expect(occurrences).toBeGreaterThanOrEqual(4)
  })
})

describe('AstroDoctorSidebarProvider', () => {
  test('exposes the correct VIEW_TYPE', () => {
    expect(AstroDoctorSidebarProvider.VIEW_TYPE).toBe('astroDoctor.sidebar')
  })

  describe('before resolveWebviewView is called', () => {
    test('setError is a no-op', async () => {
      const provider = new AstroDoctorSidebarProvider()

      await expect(provider.setError('something failed')).resolves.not.toThrow()
    })

    test('setLoading is a no-op', async () => {
      const provider = new AstroDoctorSidebarProvider()

      await expect(provider.setLoading()).resolves.not.toThrow()
    })

    test('update caches health data without posting', async () => {
      const provider = new AstroDoctorSidebarProvider()

      await expect(provider.update(makeHealthData())).resolves.not.toThrow()
    })
  })

  describe('after resolveWebviewView is called', () => {
    let provider: AstroDoctorSidebarProvider
    let webviewView: ReturnType<typeof makeWebviewView>
    let postMessage: ReturnType<typeof vi.fn>
    let onDidReceiveMessage: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      provider = new AstroDoctorSidebarProvider()
      webviewView = makeWebviewView()
      postMessage = webviewView.webview.postMessage as ReturnType<typeof vi.fn>
      onDidReceiveMessage = webviewView.webview.onDidReceiveMessage as ReturnType<typeof vi.fn>

      await provider.resolveWebviewView(
        webviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken,
      )
    })

    test('sets html on the webview', () => {
      expect((webviewView.webview as { html: string }).html).toBeTruthy()
    })

    test('enables scripts on the webview', () => {
      expect(webviewView.webview.options).toMatchObject({ enableScripts: true })
    })

    test('registers onDidReceiveMessage handler', () => {
      expect(onDidReceiveMessage).toHaveBeenCalledOnce()
    })

    test('setError posts an error message', async () => {
      await provider.setError('Server crashed')

      expect(postMessage).toHaveBeenCalledWith({
        message: 'Server crashed',
        type: 'error',
      })
    })

    test('setLoading posts a loading message', async () => {
      await provider.setLoading()

      expect(postMessage).toHaveBeenCalledWith({ type: 'loading' })
    })

    test('update posts an update message with health data and top issues', async () => {
      const data = makeHealthData({ score: 72, scoreLabel: 'C' })

      await provider.update(data)

      expect(postMessage).toHaveBeenCalledWith({
        data,
        topIssues: [],
        type: 'update',
      })
    })

    test('updateTopIssues posts updated top issues alongside cached health data', async () => {
      const data = makeHealthData()
      const issues = makeTopIssues()

      await provider.update(data)
      postMessage.mockClear()

      await provider.updateTopIssues(issues)

      expect(postMessage).toHaveBeenCalledWith({
        data,
        topIssues: issues,
        type: 'update',
      })
    })

    test('updateTopIssues is a no-op when no health data has been set', async () => {
      const issues = makeTopIssues()

      await provider.updateTopIssues(issues)

      expect(postMessage).not.toHaveBeenCalled()
    })

    test('re-sends cached data when view becomes ready', async () => {
      const data = makeHealthData({ score: 88 })

      await provider.update(data)

      const secondView = makeWebviewView()
      const secondPostMessage = secondView.webview.postMessage as ReturnType<typeof vi.fn>
      const secondOnDidReceiveMessage = secondView.webview.onDidReceiveMessage as ReturnType<typeof vi.fn>

      await provider.resolveWebviewView(
        secondView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken,
      )

      // Trigger the ready message from the webview
      const handler = secondOnDidReceiveMessage.mock.calls[0]?.[0] as (message: { type: string }) => void
      handler({ type: 'ready' })

      expect(secondPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ data, type: 'update' }),
      )
    })
  })

  describe('onOpenFile callback', () => {
    test('registers the callback and invokes it via the message handler', async () => {
      const provider = new AstroDoctorSidebarProvider()
      const webviewView = makeWebviewView()
      const onOpenFile = vi.fn()

      provider.onOpenFile(onOpenFile)

      await provider.resolveWebviewView(
        webviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken,
      )

      const messageHandler = vi.mocked(webviewView.webview.onDidReceiveMessage).mock.calls[0]?.[0] as
        | ((msg: unknown) => void)
        | undefined

      messageHandler?.({ filePath: '/src/page.astro', line: 5, type: 'openFile' })

      expect(onOpenFile).toHaveBeenCalledWith({ filePath: '/src/page.astro', line: 5 })
    })

    test('ignores messages that are not openFile type', async () => {
      const provider = new AstroDoctorSidebarProvider()
      const webviewView = makeWebviewView()
      const onOpenFile = vi.fn()

      provider.onOpenFile(onOpenFile)

      await provider.resolveWebviewView(
        webviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken,
      )

      const messageHandler = vi.mocked(webviewView.webview.onDidReceiveMessage).mock.calls[0]?.[0] as
        | ((msg: unknown) => void)
        | undefined

      messageHandler?.({ type: 'unknown' })

      expect(onOpenFile).not.toHaveBeenCalled()
    })
  })
})

describe('AstroDoctorSidebarProvider nonce generation', () => {
  test('generates a 32-character alphanumeric nonce', async () => {
    const provider = new AstroDoctorSidebarProvider()
    const webviewView = makeWebviewView()

    await provider.resolveWebviewView(
      webviewView,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken,
    )

    const html = (webviewView.webview as { html: string }).html
    const nonceMatch = /nonce="([A-Za-z0-9]+)"/.exec(html)

    expect(nonceMatch).not.toBeNull()
    expect(nonceMatch?.[1]).toHaveLength(32)
    expect(nonceMatch?.[1]).toMatch(/^[A-Za-z0-9]+$/)
  })

  test('generates a unique nonce for each view', async () => {
    const providerA = new AstroDoctorSidebarProvider()
    const providerB = new AstroDoctorSidebarProvider()
    const viewA = makeWebviewView()
    const viewB = makeWebviewView()

    await providerA.resolveWebviewView(
      viewA,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken,
    )
    await providerB.resolveWebviewView(
      viewB,
      {} as vscode.WebviewViewResolveContext,
      {} as vscode.CancellationToken,
    )

    const nonceA = /nonce="([A-Za-z0-9]+)"/.exec((viewA.webview as { html: string }).html)?.[1]
    const nonceB = /nonce="([A-Za-z0-9]+)"/.exec((viewB.webview as { html: string }).html)?.[1]

    expect(nonceA).not.toBe(nonceB)
  })
})
