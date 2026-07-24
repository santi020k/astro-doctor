/**
 * Experimental Language Server Protocol (LSP) integration for Astro Doctor.
 *
 * Streams diagnostics live into your editor as you type — underlined inline,
 * with rule descriptions on hover — in VS Code, Cursor, Zed, Neovim, Helix,
 * Emacs, Sublime, or any LSP-capable editor.
 *
 * Usage (universal):
 *   astro-doctor experimental-lsp --stdio
 *
 * VS Code / Cursor: install the companion extension (vscode-astro-doctor).
 * Neovim (nvim-lspconfig): use the `astro_doctor` server definition (coming soon).
 *
 * > The LSP is experimental — its protocol, options, and caching behavior may
 * > change between releases, hence the `experimental-` prefix.
 */

import { fileURLToPath, pathToFileURL } from 'node:url'

import type { AstroDoctorRule, RuleCategory } from '@santi020k/eslint-plugin-astro-doctor'
import astroDoctorPlugin, {
  ASTRO_ESLINT_PLUGINS,
  getAstroRuleCategory,
  getAstroRuleDocUrl,
} from '@santi020k/eslint-plugin-astro-doctor'

import * as astroParser from 'astro-eslint-parser'
import { ESLint } from 'eslint'
import type {
  CodeAction,
  Diagnostic as LspDiagnostic,
  InitializeParams,
  InitializeResult,
} from 'vscode-languageserver/node'
import {
  CodeActionKind,
  createConnection,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { scan } from './scanner/index.js'
import { isFileInDirectory } from './utils/is-file-in-directory.js'
import { loadConfig } from './config.js'
import { LSP_SCAN_DEBOUNCE_MS } from './constants.js'
import {
  aggregateResults,
  autoDiscoverAstroProjects,
  mergeConfigs,
  scanProjects,
} from './multi-project.js'
import { getPresetRules } from './presets.js'
import { getProjectRuleMeta } from './project-rules.js'
import { computeCategoryBreakdown, computeScore, computeScoreLabel } from './scorer.js'
import type { AstroDoctorConfig, Diagnostic as AstroDiagnostic, ScoreBreakdown } from './types.js'

const noop = (): void => {
  // intentionally swallows errors from fire-and-forget calls
}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const SERVER_STATUS_METHOD = 'experimental/serverStatus'
const HEALTH_SCORE_METHOD = 'experimental/healthScore'
const TOP_ISSUES_METHOD = 'experimental/topIssues'
const TOP_ISSUES_COUNT = 5

interface ServerStatusParams {
  readonly health: 'ok' | 'warning' | 'error'
  readonly quiescent: boolean
  readonly message?: string
}

interface HealthScoreParams {
  readonly score: number
  readonly scoreLabel: string
  readonly scoreBreakdown: ScoreBreakdown
  readonly fileCount: number
  readonly errorCount: number
  readonly warningCount: number
}

interface TopIssueParams {
  readonly ruleId: string
  readonly severity: 'error' | 'warning'
  readonly message: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly category: string
}

const eslintSeverityToAstro: Record<number, AstroDiagnostic['severity']> = {
  1: 'warning',
  2: 'error',
}

const eslintSeverityToLsp: Record<number, DiagnosticSeverity> = {
  1: DiagnosticSeverity.Warning,
  2: DiagnosticSeverity.Error,
}

const getRuleCategory = (ruleId: string): RuleCategory => {
  const ecosystemCategory = getAstroRuleCategory(ruleId)

  if (ecosystemCategory !== undefined) return ecosystemCategory

  const shortName = ruleId.replace('astro-doctor/', '')
  const rule = astroDoctorPlugin.rules[shortName] as AstroDoctorRule | undefined

  return rule?.meta.docs.category ?? 'best-practices'
}

const buildEslintInstance = (
  root: string,
  customRules?: Record<string, 'error' | 'warn' | 'off'>,
  overrides: AstroDoctorConfig['overrides'] = [],
): ESLint => {
  const pluginRules = customRules
    ? Object.fromEntries(
        Object.entries(customRules).filter(([ruleId]) => getProjectRuleMeta(ruleId) === undefined)
      )
    : {}

  return new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.astro'],
        plugins: {
          'astro-doctor': astroDoctorPlugin,
          ...ASTRO_ESLINT_PLUGINS,
        },
        languageOptions: {
          parser: astroParser,
          parserOptions: { sourceType: 'module' },
        },
        rules: {
          ...astroDoctorPlugin.configs.recommended?.rules,
          ...pluginRules,
        },
      },
      ...overrides.map((override) => ({
        files: [...override.files],
        rules: override.rules,
      })),
    ],
    ignore: false,
  })
}

const getEffectiveRules = (
  config: AstroDoctorConfig | null,
): Record<string, 'error' | 'warn' | 'off'> => ({
  ...getPresetRules(config?.preset ?? 'recommended'),
  ...config?.rules,
})

type EslintLintMessage = ESLint.LintResult['messages'][number]

interface MessageDiagnostics {
  readonly lsp: LspDiagnostic
  readonly astro: AstroDiagnostic
}

interface LintResult {
  readonly lsp: LspDiagnostic[]
  readonly astro: AstroDiagnostic[]
}

interface DiagnosticFixData {
  readonly fix?: {
    readonly newText: string
    readonly range: LspDiagnostic['range']
  }
  readonly suggestions?: readonly {
    readonly title: string
    readonly newText: string
    readonly range: LspDiagnostic['range']
  }[]
}

interface LspTextEdit {
  readonly newText: string
  readonly range: LspDiagnostic['range']
}

const isDiagnosticFixData = (value: unknown): value is DiagnosticFixData => {
  if (typeof value !== 'object' || value === null) return false

  return 'fix' in value || 'suggestions' in value
}

const getCommandUri = (commandArguments: unknown): string | undefined => {
  if (!Array.isArray(commandArguments)) return undefined

  const firstArgument: unknown = commandArguments[0]

  if (typeof firstArgument !== 'object' || firstArgument === null || !('uri' in firstArgument)) {
    return undefined
  }

  return typeof firstArgument.uri === 'string' ? firstArgument.uri : undefined
}

const getRuleDocUrl = (ruleId: string): string | undefined => {
  const ecosystemUrl = getAstroRuleDocUrl(ruleId)

  if (ecosystemUrl !== undefined) return ecosystemUrl

  const shortName = ruleId.replace('astro-doctor/', '')

  const ruleDocs = (
    astroDoctorPlugin.rules[shortName]?.meta as
      | { docs?: { url?: string } }
      | undefined
  )?.docs

  return ruleDocs?.url
}

const toDocumentRange = (
  document: TextDocument,
  range: readonly [number, number],
): LspDiagnostic['range'] => ({
  start: document.positionAt(range[0]),
  end: document.positionAt(range[1]),
})

const buildDiagnosticFixData = (
  message: EslintLintMessage,
  document: TextDocument,
): DiagnosticFixData | undefined => {
  const fix = message.fix
    ? {
        newText: message.fix.text,
        range: toDocumentRange(document, message.fix.range),
      }
    : undefined

  const suggestions = message.suggestions?.map((suggestion) => ({
    title: suggestion.desc,
    newText: suggestion.fix.text,
    range: toDocumentRange(document, suggestion.fix.range),
  }))

  if (fix === undefined && (suggestions === undefined || suggestions.length === 0)) {
    return undefined
  }

  return {
    ...(fix === undefined ? {} : { fix }),
    ...(suggestions === undefined || suggestions.length === 0 ? {} : { suggestions }),
  }
}

const buildMessageDiagnostics = (
  msg: EslintLintMessage,
  filePath: string,
  document: TextDocument,
): MessageDiagnostics | null => {
  if (!msg.ruleId) return null

  const startLine = Math.max(0, msg.line - 1)
  const startChar = Math.max(0, msg.column - 1)
  const endLine = msg.endLine === undefined ? startLine : Math.max(0, msg.endLine - 1)
  const endChar = msg.endColumn === undefined ? startChar + 1 : Math.max(0, msg.endColumn - 1)
  const docUrl = getRuleDocUrl(msg.ruleId)
  const fixData = buildDiagnosticFixData(msg, document)

  return {
    lsp: {
      range: {
        start: { line: startLine, character: startChar },
        end: { line: endLine, character: endChar },
      },
      severity: eslintSeverityToLsp[msg.severity] ?? DiagnosticSeverity.Warning,
      code: msg.ruleId,
      codeDescription: docUrl ? { href: docUrl } : undefined,
      source: 'astro-doctor',
      message: msg.message,
      data: fixData,
    },
    astro: {
      ruleId: msg.ruleId,
      severity: eslintSeverityToAstro[msg.severity] ?? 'warning',
      message: msg.message,
      filePath,
      line: msg.line,
      column: msg.column,
      category: getRuleCategory(msg.ruleId),
    },
  }
}

const lintFileContent = async (
  eslint: ESLint,
  content: string,
  filePath: string,
): Promise<LintResult> => {
  const results = await eslint.lintText(content, { filePath })
  const result = results[0]
  const document = TextDocument.create(pathToFileURL(filePath).toString(), 'astro', 1, content)

  if (!result) return { lsp: [], astro: [] }

  const lsp: LspDiagnostic[] = []
  const astro: AstroDiagnostic[] = []

  for (const msg of result.messages) {
    const diags = buildMessageDiagnostics(msg, filePath, document)

    if (!diags) continue

    lsp.push(diags.lsp)

    astro.push(diags.astro)
  }

  return { lsp, astro }
}

interface DiagnosticPosition {
  readonly line: number
  readonly character: number
}

const isInDiagnosticRange = (diag: LspDiagnostic, position: DiagnosticPosition): boolean =>
  position.line >= diag.range.start.line &&
  position.line <= diag.range.end.line &&
  position.character >= diag.range.start.character &&
  position.character <= diag.range.end.character

const buildAstroDiagLspDiagnostic = (d: AstroDiagnostic): LspDiagnostic => {
  const docUrl = getRuleDocUrl(d.ruleId)

  return {
    range: {
      start: { line: Math.max(0, d.line - 1), character: Math.max(0, d.column - 1) },
      end: { line: Math.max(0, d.line - 1), character: Math.max(0, d.column - 1) + 1 },
    },
    severity: d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    code: d.ruleId,
    codeDescription: docUrl ? { href: docUrl } : undefined,
    source: 'astro-doctor',
    message: d.message,
  }
}

export const buildCodeActionsForDiagnostic = (
  documentUri: string,
  diagnostic: LspDiagnostic,
): CodeAction[] => {
  if (diagnostic.source !== 'astro-doctor' || typeof diagnostic.code !== 'string') return []

  const codeActions: CodeAction[] = []
  const ruleId = diagnostic.code
  const docUrl = getRuleDocUrl(ruleId)
  const diagnosticData: unknown = diagnostic.data
  const fixData = isDiagnosticFixData(diagnosticData) ? diagnosticData : undefined

  if (fixData?.fix) {
    codeActions.push({
      title: `Fix ${ruleId}`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      isPreferred: true,
      edit: {
        changes: {
          [documentUri]: [{
            range: fixData.fix.range,
            newText: fixData.fix.newText,
          }],
        },
      },
    })
  }

  for (const suggestion of fixData?.suggestions ?? []) {
    codeActions.push({
      title: suggestion.title,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [documentUri]: [{
            range: suggestion.range,
            newText: suggestion.newText,
          }],
        },
      },
    })
  }

  const line = diagnostic.range.start.line

  codeActions.push({
    title: `Disable ${ruleId} for this line`,
    kind: CodeActionKind.QuickFix,
    diagnostics: [diagnostic],
    edit: {
      changes: {
        [documentUri]: [{
          range: { start: { line, character: 0 }, end: { line, character: 0 } },
          newText: `// eslint-disable-next-line ${ruleId}\n`,
        }],
      },
    },
  })

  if (docUrl !== undefined) {
    codeActions.push({
      title: `Open documentation for ${ruleId}`,
      kind: CodeActionKind.Empty,
      command: {
        title: `Open documentation for ${ruleId}`,
        command: 'astro-doctor.openDocs',
        arguments: [docUrl],
      },
    })
  }

  return codeActions
}

export const runLsp = (): void => {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  let workspaceRoot = process.cwd()
  let hasWorkspaceFolder = false
  let eslintInstance: ESLint | null = null
  let scanOnType = true
  let workspaceFileCount = 0
  const projectEslintInstances = new Map<string, ESLint>()
  const pendingDocumentScans = new Map<string, NodeJS.Timeout>()
  let workspaceScanGeneration = 0
  // Keyed by absolute file path
  const fileAstroDiagnostics = new Map<string, AstroDiagnostic[]>()
  // Keyed by document URI (file://...)
  const fileLspDiagnostics = new Map<string, LspDiagnostic[]>()

  const sendStatus = (params: ServerStatusParams): void => {
    connection.sendNotification(SERVER_STATUS_METHOD, params).catch(noop)
  }

  const computeHealthScore = (): HealthScoreParams => {
    const allDiags = [...fileAstroDiagnostics.values()].flat()
    const errorCount = allDiags.filter((d) => d.severity === 'error').length
    const warningCount = allDiags.filter((d) => d.severity === 'warning').length
    const score = computeScore(allDiags, workspaceFileCount)

    return {
      score,
      scoreLabel: computeScoreLabel(score),
      scoreBreakdown: computeCategoryBreakdown(allDiags, workspaceFileCount),
      fileCount: workspaceFileCount,
      errorCount,
      warningCount,
    }
  }

  const publishHealthScore = (): void => {
    connection.sendNotification(HEALTH_SCORE_METHOD, computeHealthScore()).catch(noop)
  }

  const publishTopIssues = (): void => {
    const allDiags = [...fileAstroDiagnostics.values()].flat()

    const sorted = [...allDiags].sort((firstDiag, secondDiag) => {
      const severityOrder = { error: 0, warning: 1 }

      return severityOrder[firstDiag.severity] - severityOrder[secondDiag.severity]
    })

    const topIssues: TopIssueParams[] = sorted.slice(0, TOP_ISSUES_COUNT).map((diagnostic) => ({
      ruleId: diagnostic.ruleId,
      severity: diagnostic.severity,
      message: diagnostic.message,
      filePath: diagnostic.filePath,
      line: diagnostic.line,
      column: diagnostic.column,
      category: diagnostic.category,
    }))

    connection.sendNotification(TOP_ISSUES_METHOD, topIssues).catch(noop)
  }

  const doInitialScan = async (): Promise<void> => {
    const scanGeneration = ++workspaceScanGeneration

    sendStatus({ health: 'ok', quiescent: false, message: 'Scanning workspace…' })

    try {
      const nextConfig = await loadConfig(workspaceRoot)
      const effectiveRules = getEffectiveRules(nextConfig)

      const nextEslintInstance = buildEslintInstance(
        workspaceRoot,
        effectiveRules,
        nextConfig?.overrides,
      )

      if (!hasWorkspaceFolder) {
        if (scanGeneration !== workspaceScanGeneration) return

        eslintInstance = nextEslintInstance

        workspaceFileCount = 0

        publishHealthScore()

        publishTopIssues()

        sendStatus({ health: 'ok', quiescent: true })

        return
      }

      const discoveredProjects = await autoDiscoverAstroProjects(workspaceRoot)
      const nextProjectEslintInstances = new Map<string, ESLint>()
      let result

      if (discoveredProjects.length > 0) {
        for (const pkg of discoveredProjects) {
          const projectConfig = await loadConfig(pkg.directory)
          const mergedConfig = mergeConfigs(nextConfig, projectConfig)
          const projectRules = getEffectiveRules(mergedConfig)

          nextProjectEslintInstances.set(
            pkg.directory,
            buildEslintInstance(pkg.directory, projectRules, mergedConfig.overrides),
          )
        }

        const projectResults = await scanProjects({
          rootDirectory: workspaceRoot,
          projectArgs: discoveredProjects.map((p) => p.directory),
          rootConfig: nextConfig,
          scanOptions: { cache: true, noLint: false, noRespectInlineDisables: false },
        })

        result = aggregateResults(projectResults)
      } else {
        result = await scan({
          directory: workspaceRoot,
          ignore: nextConfig?.ignore,
          overrides: nextConfig?.overrides,
          rules: effectiveRules,
          cache: true,
        })
      }

      if (scanGeneration !== workspaceScanGeneration) return

      eslintInstance = nextEslintInstance

      projectEslintInstances.clear()

      for (const [projectDirectory, projectEslint] of nextProjectEslintInstances) {
        projectEslintInstances.set(projectDirectory, projectEslint)
      }

      workspaceFileCount = result.fileCount

      fileAstroDiagnostics.clear()

      fileLspDiagnostics.clear()

      // Group AstroDiagnostics by file path
      for (const diag of result.diagnostics) {
        const existing = fileAstroDiagnostics.get(diag.filePath) ?? []

        fileAstroDiagnostics.set(diag.filePath, [...existing, diag])
      }

      // Convert to LSP diagnostics and publish per file
      for (const [filePath, diags] of fileAstroDiagnostics.entries()) {
        const uri = pathToFileURL(filePath).toString()
        const lspDiags: LspDiagnostic[] = diags.map(buildAstroDiagLspDiagnostic)

        fileLspDiagnostics.set(uri, lspDiags)

        connection.sendDiagnostics({ uri, diagnostics: lspDiags }).catch(noop)
      }

      publishHealthScore()

      publishTopIssues()

      sendStatus({ health: 'ok', quiescent: true })
    } catch (error) {
      const message = toErrorMessage(error)

      sendStatus({ health: 'error', quiescent: true, message: `Scan failed: ${message}` })
    }
  }

  const getEslintInstanceForFile = (filePath: string): ESLint | null => {
    let closestDir = ''
    let closestEslint: ESLint | null = null

    for (const [dir, eslint] of projectEslintInstances.entries()) {
      if (isFileInDirectory(filePath, dir) && dir.length > closestDir.length) {
        closestDir = dir

        closestEslint = eslint
      }
    }

    return closestEslint ?? eslintInstance
  }

  const applyAllFixes = async (uri: string): Promise<void> => {
    const document = documents.get(uri)

    if (!document) return

    let filePath: string

    try {
      filePath = fileURLToPath(uri)
    } catch {
      return
    }

    const activeEslint = getEslintInstanceForFile(filePath)

    if (!activeEslint) return

    const { lsp } = await lintFileContent(activeEslint, document.getText(), filePath)
    const edits: LspTextEdit[] = []

    for (const diagnostic of lsp) {
      const diagnosticData: unknown = diagnostic.data

      if (!isDiagnosticFixData(diagnosticData) || diagnosticData.fix === undefined) continue

      edits.push({
        newText: diagnosticData.fix.newText,
        range: diagnosticData.fix.range,
      })
    }

    if (edits.length === 0) return

    await connection.workspace.applyEdit({
      changes: {
        [uri]: edits,
      },
    })
  }

  const lintDocument = async (document: TextDocument): Promise<void> => {
    let filePath: string

    try {
      filePath = fileURLToPath(document.uri)
    } catch {
      return
    }

    if (!filePath.endsWith('.astro')) return

    const activeEslint = getEslintInstanceForFile(filePath)

    if (!activeEslint) return

    sendStatus({ health: 'ok', quiescent: false })

    try {
      const { lsp, astro } = await lintFileContent(
        activeEslint,
        document.getText(),
        filePath,
      )

      if (documents.get(document.uri)?.version !== document.version) return

      // Update state — add to workspace file count if this is a new file
      if (!fileAstroDiagnostics.has(filePath)) {
        workspaceFileCount++
      }

      fileAstroDiagnostics.set(filePath, astro)

      fileLspDiagnostics.set(document.uri, lsp)

      connection.sendDiagnostics({ uri: document.uri, diagnostics: lsp }).catch(noop)

      publishHealthScore()

      publishTopIssues()

      sendStatus({ health: 'ok', quiescent: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      sendStatus({ health: 'warning', quiescent: true, message: `Lint failed: ${message}` })
    }
  }

  const scheduleLintDocument = (document: TextDocument): void => {
    const pendingScan = pendingDocumentScans.get(document.uri)

    if (pendingScan !== undefined) clearTimeout(pendingScan)

    pendingDocumentScans.set(
      document.uri,
      setTimeout(() => {
        pendingDocumentScans.delete(document.uri)

        lintDocument(document).catch(noop)
      }, LSP_SCAN_DEBOUNCE_MS),
    )
  }

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    const folderUri = params.workspaceFolders?.[0]?.uri ?? ''

    if (folderUri) {
      workspaceRoot = folderUri.startsWith('file://') ? fileURLToPath(folderUri) : folderUri

      hasWorkspaceFolder = true
    } else {
      hasWorkspaceFolder = false
    }

    const options = params.initializationOptions as { scanOnType?: boolean } | undefined

    scanOnType = options?.scanOnType ?? true

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        hoverProvider: true,
        executeCommandProvider: {
          commands: ['astro-doctor.fixAll', 'astro-doctor.scanWorkspace'],
        },
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix],
        },
      },
    }
  })

  connection.onInitialized((): void => {
    doInitialScan().catch(noop)
  })

  connection.onExecuteCommand((parameters): void => {
    const { command } = parameters

    if (command === 'astro-doctor.scanWorkspace') {
      doInitialScan().catch(noop)

      return
    }

    if (command !== 'astro-doctor.fixAll') return

    const commandArguments: unknown = parameters.arguments
    const uri = getCommandUri(commandArguments)

    if (typeof uri !== 'string') return

    applyAllFixes(uri).catch(noop)
  })

  documents.onDidOpen(({ document }) => {
    lintDocument(document).catch(noop)
  })

  documents.onDidChangeContent(({ document }) => {
    if (scanOnType) scheduleLintDocument(document)
  })

  documents.onDidSave(({ document }) => {
    if (!scanOnType) lintDocument(document).catch(noop)
  })

  documents.onDidClose(({ document }) => {
    const pendingScan = pendingDocumentScans.get(document.uri)

    if (pendingScan !== undefined) clearTimeout(pendingScan)

    pendingDocumentScans.delete(document.uri)

    // Clear LSP diagnostics but keep AstroDiagnostics for the health score
    fileLspDiagnostics.delete(document.uri)

    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] }).catch(noop)
  })

  connection.onDidChangeWatchedFiles(() => {
    doInitialScan().catch(noop)
  })

  connection.onHover(({ textDocument, position }) => {
    const diags = fileLspDiagnostics.get(textDocument.uri) ?? []
    const diag = diags.find((d) => isInDiagnosticRange(d, position))

    if (!diag || typeof diag.code !== 'string') return null

    const shortName = diag.code.replace('astro-doctor/', '')

    const ruleMeta = astroDoctorPlugin.rules[shortName]?.meta as
      | { docs?: { description?: string; url?: string }; messages?: Record<string, string> }
      | undefined

    const category = getRuleCategory(diag.code)
    const description = ruleMeta?.docs?.description ?? diag.message
    const docsUrl = getRuleDocUrl(shortName)

    const lines = [
      `**\`${diag.code}\`** _(${category})_`,
      '',
      description,
    ]

    if (docsUrl) lines.push('', `[View documentation →](${docsUrl})`)

    return {
      contents: { kind: 'markdown', value: lines.map(String).join('\n') },
      range: diag.range,
    }
  })

  connection.onCodeAction(({ textDocument, context }) => context.diagnostics.flatMap((diagnostic) =>
      buildCodeActionsForDiagnostic(textDocument.uri, diagnostic)
    ))

  documents.listen(connection)

  connection.listen()
}
