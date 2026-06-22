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

import { AstroDoctorSidebarProvider, type HealthScoreData, type TopIssueData } from './sidebar-provider'

const CLIENT_ID = 'astroDoctor'
const CLIENT_NAME = 'Astro Doctor'
const COMMAND_SCAN_FILE = 'astro-doctor.scanFile'
const COMMAND_FIX_ALL = 'astro-doctor.fixAll'
const COMMAND_RESTART = 'astro-doctor.restart'
const COMMAND_SHOW_OUTPUT = 'astro-doctor.showOutput'
const COMMAND_OPEN_DOCS = 'astro-doctor.openDocs'
const SERVER_STATUS_METHOD = 'experimental/serverStatus'
const HEALTH_SCORE_METHOD = 'experimental/healthScore'
const TOP_ISSUES_METHOD = 'experimental/topIssues'
const STATUS_BAR_PRIORITY = 100
const ENV_LOCAL = 'local'
const ENV_PRODUCTION = 'production'

interface ServerStatusParams {
  readonly health: 'error' | 'ok' | 'warning'
  readonly message?: string
  readonly quiescent: boolean
}

const IS_WINDOWS = process.platform === 'win32'
const ACTIVE_FILE_COMMANDS = new Set([COMMAND_FIX_ALL, COMMAND_SCAN_FILE])
let client: LanguageClient | undefined

interface ExtensionRuntime {
  readonly environment: string
  readonly preferWorkspaceServer: boolean
}

interface ResolvedServer {
  readonly args: string[]
  readonly command: string
  readonly shell: boolean
}

export const resolveRuntime = (context: vscode.ExtensionContext): ExtensionRuntime => {
  const configuredEnvironment = process.env.ASTRO_DOCTOR_EXTENSION_ENV?.trim()

  if (configuredEnvironment === ENV_LOCAL) {
    return { environment: ENV_LOCAL, preferWorkspaceServer: true }
  }

  if (configuredEnvironment === ENV_PRODUCTION) {
    return { environment: ENV_PRODUCTION, preferWorkspaceServer: false }
  }

  if (context.extensionMode === vscode.ExtensionMode.Development) {
    return { environment: ENV_LOCAL, preferWorkspaceServer: true }
  }

  return { environment: ENV_PRODUCTION, preferWorkspaceServer: false }
}

export const resolveConfiguredServer = (
  configuration: vscode.WorkspaceConfiguration,
): ResolvedServer | undefined => {
  const explicitPath = configuration.get<string>('serverPath', '').trim()

  if (explicitPath.length > 0) {
    return { args: ['experimental-lsp'], command: explicitPath, shell: false }
  }

  return undefined
}

export const resolveDevelopmentServer = async (extensionPath: string): Promise<ResolvedServer | undefined> => {
  const developmentServer = path.join(
    extensionPath,
    '..',
    'astro-doctor',
    'dist',
    'bin',
    'astro-doctor.js',
  )

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(developmentServer))

    return {
      args: [developmentServer, 'experimental-lsp'],
      command: process.execPath,
      shell: false,
    }
  } catch {
    return undefined
  }
}

export const resolveWorkspaceServer = async (): Promise<ResolvedServer | undefined> => {
  const binName = IS_WINDOWS ? 'astro-doctor.cmd' : 'astro-doctor'

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const localBin = path.join(folder.uri.fsPath, 'node_modules', '.bin', binName)

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(localBin))

      return { args: ['experimental-lsp'], command: localBin, shell: IS_WINDOWS }
    } catch {
      // ignore
    }
  }

  return undefined
}

export const resolveBundledServer = async (extensionPath: string): Promise<string | undefined> => {
  const bundledServer = path.join(extensionPath, 'dist', 'server.mjs')

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(bundledServer))

    return bundledServer
  } catch {
    return undefined
  }
}

const showMissingServer = async (
  outputChannel: vscode.OutputChannel,
): Promise<void> => {
  const message = `${CLIENT_NAME}: language server not found. Reinstall the extension, install @santi020k/astro-doctor locally, or set astroDoctor.serverPath.`

  outputChannel.appendLine(message)

  await vscode.window.showErrorMessage(message)
}

const showStartFailure = async (
  outputChannel: vscode.OutputChannel,
  error: unknown,
): Promise<void> => {
  outputChannel.appendLine(
    `Failed to start the Astro Doctor language server: ${error instanceof Error ? error.message : String(error)}`,
  )

  await vscode.window.showErrorMessage(
    `${CLIENT_NAME}: failed to start. Reinstall the extension, install @santi020k/astro-doctor locally, or set astroDoctor.serverPath.`,
  )
}

const createExecutable = (resolved: ResolvedServer): Executable => {
  const nodeOptions = process.env.NODE_OPTIONS ?? ''

  return {
    args: resolved.args,
    command: resolved.command,
    options: {
      env: {
        ...process.env,
        NODE_OPTIONS: `${nodeOptions} --no-deprecation`.trim(),
      },
      shell: resolved.shell,
    },
    transport: TransportKind.stdio,
  }
}

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
    transport: TransportKind.ipc,
  },
  run: {
    module: serverModule,
    transport: TransportKind.ipc,
  },
})

export const createServerOptions = async (
  configuration: vscode.WorkspaceConfiguration,
  extensionPath: string,
  outputChannel: vscode.OutputChannel,
  runtime: ExtensionRuntime,
): Promise<ServerOptions | undefined> => {
  const configuredServer = resolveConfiguredServer(configuration)

  if (configuredServer) return createExecutableServerOptions(configuredServer)

  if (runtime.preferWorkspaceServer) {
    const developmentServer = await resolveDevelopmentServer(extensionPath)

    if (developmentServer) return createExecutableServerOptions(developmentServer)

    const workspaceServer = await resolveWorkspaceServer()

    if (workspaceServer) return createExecutableServerOptions(workspaceServer)
  }

  const bundledServer = await resolveBundledServer(extensionPath)

  if (bundledServer) return createBundledServerOptions(bundledServer)

  if (!runtime.preferWorkspaceServer) {
    const workspaceServer = await resolveWorkspaceServer()

    if (workspaceServer) return createExecutableServerOptions(workspaceServer)
  }

  await showMissingServer(outputChannel)

  return undefined
}

export const renderStatus = (item: vscode.StatusBarItem, status: ServerStatusParams): void => {
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

export const createServerStatusFeature = (): StaticFeature => ({
  clear() {
    
  },
  fillClientCapabilities(capabilities: ClientCapabilities) {
    const experimental = (
      capabilities.experimental ?? (capabilities.experimental = {})
    ) as Record<string, unknown>

    experimental.serverStatusNotification = true
  },
  getState(): FeatureState {
    return { kind: 'static' }
  },
  initialize() {
    
  },
})

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const configuration = vscode.workspace.getConfiguration(CLIENT_ID)

  if (!configuration.get<boolean>('enable', true)) return

  const runtime = resolveRuntime(context)
  const outputChannel = vscode.window.createOutputChannel(CLIENT_NAME)
  const serverOptions = await createServerOptions(configuration, context.extensionPath, outputChannel, runtime)

  if (!serverOptions) return

  outputChannel.appendLine(`${CLIENT_NAME}: using ${runtime.environment} environment`)

  // Sidebar
  const sidebarProvider = new AstroDoctorSidebarProvider()

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'astro', scheme: 'file' }],
    initializationOptions: {
      scanOnType: configuration.get<boolean>('scanOnType', true),
    },
    middleware: {
      executeCommand: async (command, commandArguments, forwardToServer) => {
        if (command === COMMAND_RESTART) {
          await client?.restart()

          return
        }

        if (!ACTIVE_FILE_COMMANDS.has(command) || commandArguments.length > 0) {
          const result: unknown = await Promise.resolve(forwardToServer(command, commandArguments))

          return result
        }

        const activeDocumentUri = vscode.window.activeTextEditor?.document.uri.toString()

        if (activeDocumentUri === undefined) {
          await vscode.window.showInformationMessage(
            `${CLIENT_NAME}: open an Astro file in the editor to run this command.`,
          )

          return
        }

        const result: unknown = await Promise.resolve(forwardToServer(command, [{ uri: activeDocumentUri }]))

        return result
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
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    STATUS_BAR_PRIORITY,
  )

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
    vscode.commands.registerCommand(COMMAND_OPEN_DOCS, async (url: string) => {
      await vscode.env.openExternal(vscode.Uri.parse(url))
    }),
    vscode.commands.registerCommand(COMMAND_RESTART, async () => {
      await client?.restart()
    }),
  )

  try {
    await languageClient.start()

    languageClient.onNotification(SERVER_STATUS_METHOD, (status: ServerStatusParams) => {
      renderStatus(statusBarItem, status)

      if (!status.quiescent) {
        sidebarProvider.setLoading().catch(() => {})
      } else if (status.health === 'error') {
        sidebarProvider.setError(status.message ?? 'Server error').catch(() => {})
      }
    })

    languageClient.onNotification(HEALTH_SCORE_METHOD, (data: HealthScoreData) => {
      sidebarProvider.update(data).catch(() => {})

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

    languageClient.onNotification(TOP_ISSUES_METHOD, (issues: TopIssueData[]) => {
      sidebarProvider.updateTopIssues(issues).catch(() => {})
    })

    sidebarProvider.onOpenFile(({ filePath, line }) => {
      const uri = vscode.Uri.file(filePath)

      vscode.window.showTextDocument(uri)
        .then((editor) => {
          const targetPosition = new vscode.Position(Math.max(0, line - 1), 0)

          editor.revealRange(
            new vscode.Range(targetPosition, targetPosition),
            vscode.TextEditorRevealType.InCenter,
          )

          editor.selection = new vscode.Selection(targetPosition, targetPosition)

          return editor
        }, () => {})
    })

    renderStatus(statusBarItem, { health: 'ok', quiescent: true })
  } catch (error) {
    renderStatus(statusBarItem, {
      health: 'error',
      message: `${CLIENT_NAME}: failed to start`,
      quiescent: true,
    })

    await sidebarProvider.setError('Failed to start. Ensure Node.js is installed and astro-doctor is available.')

    await showStartFailure(outputChannel, error)
  }
}

export const deactivate = (): Thenable<void> | undefined => client?.stop()
