import * as fs from 'node:fs'
import * as path from 'node:path'

import * as vscode from 'vscode'
import {
  type ClientCapabilities,
  type Executable,
  type FeatureState,
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  type StaticFeature,
  TransportKind,
} from 'vscode-languageclient/node'

import { AstroDoctorSidebarProvider, type HealthScoreData } from './sidebar-provider'

const CLIENT_ID = 'astroDoctor'
const CLIENT_NAME = 'Astro Doctor'
const COMMAND_SCAN_FILE = 'astro-doctor.scanFile'
const COMMAND_FIX_ALL = 'astro-doctor.fixAll'
const COMMAND_RESTART = 'astro-doctor.restart'
const COMMAND_SHOW_OUTPUT = 'astro-doctor.showOutput'
const COMMAND_OPEN_DOCS = 'astro-doctor.openDocs'
const SERVER_STATUS_METHOD = 'experimental/serverStatus'
const HEALTH_SCORE_METHOD = 'experimental/healthScore'

interface ServerStatusParams {
  readonly health: 'error' | 'ok' | 'warning'
  readonly message?: string
  readonly quiescent: boolean
}

const IS_WINDOWS = process.platform === 'win32'
const ACTIVE_FILE_COMMANDS = new Set([COMMAND_FIX_ALL, COMMAND_SCAN_FILE])
let client: LanguageClient | undefined

interface ResolvedServer {
  readonly args: string[]
  readonly command: string
  readonly shell: boolean
}

const resolveServer = (
  configuration: vscode.WorkspaceConfiguration,
): ResolvedServer | undefined => {
  const explicitPath = configuration.get<string>('serverPath', '').trim()

  if (explicitPath.length > 0) {
    return { args: ['experimental-lsp'], command: explicitPath, shell: false }
  }

  const binName = IS_WINDOWS ? 'astro-doctor.cmd' : 'astro-doctor'

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const localBin = path.join(folder.uri.fsPath, 'node_modules', '.bin', binName)

    if (fs.existsSync(localBin)) {
      return { args: ['experimental-lsp'], command: localBin, shell: IS_WINDOWS }
    }
  }

  return undefined
}

const resolveBundledServer = (extensionPath: string): string | undefined => {
  const bundledServer = path.join(extensionPath, 'dist', 'server.mjs')

  if (fs.existsSync(bundledServer)) {
    return bundledServer
  }

  return undefined
}

const showMissingServer = (
  outputChannel: vscode.OutputChannel,
): void => {
  const message = `${CLIENT_NAME}: language server not found. Reinstall the extension, install @santi020k/astro-doctor locally, or set astroDoctor.serverPath.`

  outputChannel.appendLine(message)

  void vscode.window.showErrorMessage(message)
}

const showStartFailure = (
  outputChannel: vscode.OutputChannel,
  error: unknown,
): void => {
  outputChannel.appendLine(
    `Failed to start the Astro Doctor language server: ${error instanceof Error ? error.message : String(error)}`,
  )

  void vscode.window.showErrorMessage(
    `${CLIENT_NAME}: failed to start. Reinstall the extension, install @santi020k/astro-doctor locally, or set astroDoctor.serverPath.`,
  )
}

const createExecutable = (resolved: ResolvedServer): Executable => ({
  args: resolved.args,
  command: resolved.command,
  options: { shell: resolved.shell },
  transport: TransportKind.stdio,
})

const createExecutableServerOptions = (resolved: ResolvedServer): ServerOptions => {
  const executable = createExecutable(resolved)

  return {
    debug: executable,
    run: executable,
  }
}

const createBundledServerOptions = (serverModule: string): ServerOptions => ({
  debug: {
    module: serverModule,
    transport: TransportKind.stdio,
  },
  run: {
    module: serverModule,
    transport: TransportKind.stdio,
  },
})

const createServerOptions = (
  configuration: vscode.WorkspaceConfiguration,
  extensionPath: string,
  outputChannel: vscode.OutputChannel,
): ServerOptions | undefined => {
  const resolved = resolveServer(configuration)

  if (resolved) return createExecutableServerOptions(resolved)

  const bundledServer = resolveBundledServer(extensionPath)

  if (bundledServer) return createBundledServerOptions(bundledServer)

  showMissingServer(outputChannel)

  return undefined
}

const renderStatus = (item: vscode.StatusBarItem, status: ServerStatusParams): void => {
  if (!status.quiescent) {
    item.text = '$(sync~spin) Astro Doctor'

    item.tooltip = `${CLIENT_NAME}: scanning…`

    return
  }

  if (status.health === 'error') {
    item.text = '$(error) Astro Doctor'
  } else if (status.health === 'warning') {
    item.text = '$(warning) Astro Doctor'
  } else {
    item.text = '$(check) Astro Doctor'
  }

  item.tooltip = status.message ?? `${CLIENT_NAME}: ready`
}

const createServerStatusFeature = (): StaticFeature => ({
  clear() {},
  fillClientCapabilities(capabilities: ClientCapabilities) {
    const experimental = (
      capabilities.experimental ?? (capabilities.experimental = {})
    ) as Record<string, unknown>

    experimental.serverStatusNotification = true
  },
  getState(): FeatureState {
    return { kind: 'static' }
  },
  initialize() {},
})

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const configuration = vscode.workspace.getConfiguration(CLIENT_ID)

  if (!configuration.get<boolean>('enable', true)) return

  const outputChannel = vscode.window.createOutputChannel(CLIENT_NAME)
  const serverOptions = createServerOptions(configuration, context.extensionPath, outputChannel)

  if (!serverOptions) return

  // Sidebar
  const sidebarProvider = new AstroDoctorSidebarProvider()

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'astro', scheme: 'file' }],
    initializationOptions: {
      scanOnType: configuration.get<boolean>('scanOnType', true),
    },
    middleware: {
      executeCommand: (command, commandArguments, forwardToServer) => {
        if (command === COMMAND_RESTART) return client?.restart()

        if (!ACTIVE_FILE_COMMANDS.has(command) || commandArguments.length > 0) {
          return forwardToServer(command, commandArguments)
        }

        const activeDocumentUri = vscode.window.activeTextEditor?.document.uri.toString()

        if (activeDocumentUri === undefined) {
          void vscode.window.showInformationMessage(
            `${CLIENT_NAME}: open an Astro file in the editor to run this command.`,
          )

          return
        }

        return forwardToServer(command, [{ uri: activeDocumentUri }])
      },
    },
    outputChannel,
    traceOutputChannel: outputChannel,
  }

  const languageClient = new LanguageClient(
    CLIENT_ID,
    CLIENT_NAME,
    serverOptions,
    clientOptions,
  )

  client = languageClient

  languageClient.registerFeature(createServerStatusFeature())

  // Status bar item (footer)
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)

  statusBarItem.command = COMMAND_SHOW_OUTPUT

  renderStatus(statusBarItem, { health: 'ok', message: `${CLIENT_NAME}: starting…`, quiescent: false })

  statusBarItem.show()

  context.subscriptions.push(
    outputChannel,
    languageClient,
    statusBarItem,
    vscode.window.registerWebviewViewProvider(
      AstroDoctorSidebarProvider.VIEW_TYPE,
      sidebarProvider,
    ),
    vscode.commands.registerCommand(COMMAND_SHOW_OUTPUT, () => { outputChannel.show(); }),
    vscode.commands.registerCommand(COMMAND_OPEN_DOCS, (url: string) => {
      void vscode.env.openExternal(vscode.Uri.parse(url))
    }),
    vscode.commands.registerCommand(COMMAND_RESTART, () => {
      void client?.restart()
    }),
    vscode.commands.registerCommand(COMMAND_SCAN_FILE, () => {
      const uri = vscode.window.activeTextEditor?.document.uri.toString()

      if (!uri) {
        void vscode.window.showInformationMessage(
          `${CLIENT_NAME}: open an Astro file to scan.`,
        )

        return
      }

      void languageClient.sendRequest('workspace/executeCommand', {
        arguments: [{ uri }],
        command: COMMAND_SCAN_FILE,
      })
    }),
  )

  try {
    await languageClient.start()

    languageClient.onNotification(SERVER_STATUS_METHOD, (status: ServerStatusParams) => {
      renderStatus(statusBarItem, status)

      if (!status.quiescent) {
        sidebarProvider.setLoading()
      } else if (status.health === 'error') {
        sidebarProvider.setError(status.message ?? 'Server error')
      }
    })

    languageClient.onNotification(HEALTH_SCORE_METHOD, (data: HealthScoreData) => {
      sidebarProvider.update(data)

      // Update status bar score text
      const label = data.scoreLabel
      const score = data.score

      if (data.errorCount > 0) {
        statusBarItem.text = `$(error) Astro Doctor ${score}/100`
      } else if (data.warningCount > 0) {
        statusBarItem.text = `$(warning) Astro Doctor ${score}/100`
      } else {
        statusBarItem.text = `$(check) Astro Doctor ${score}/100`
      }

      statusBarItem.tooltip = `Astro Doctor: Grade ${label} (${score}/100) — ${data.fileCount} files, ${data.errorCount} errors, ${data.warningCount} warnings`
    })

    renderStatus(statusBarItem, { health: 'ok', quiescent: true })
  } catch (error) {
    renderStatus(statusBarItem, {
      health: 'error',
      message: `${CLIENT_NAME}: failed to start`,
      quiescent: true,
    })

    sidebarProvider.setError('Failed to start. Ensure Node.js is installed and astro-doctor is available.')

    showStartFailure(outputChannel, error)
  }
}

export const deactivate = (): Thenable<void> | undefined => client?.stop()
