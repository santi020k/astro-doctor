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
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

import * as astroParser from 'astro-eslint-parser'
import { ESLint } from 'eslint'
import type {
  CodeAction,
  Diagnostic as LspDiagnostic,
  InitializeParams,
  InitializeResult,
} from 'vscode-languageserver/node.js'
import {
  CodeActionKind,
  createConnection,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { scan } from './scanner/index.js'
import { loadConfig } from './config.js'
import { computeCategoryBreakdown, computeScore, computeScoreLabel } from './scorer.js'
import type { AstroDoctorConfig, Diagnostic as AstroDiagnostic, ScoreBreakdown } from './types.js'

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
  const shortName = ruleId.replace('astro-doctor/', '')
  const rule = astroDoctorPlugin.rules[shortName] as AstroDoctorRule | undefined

  return rule?.meta.docs.category ?? 'best-practices'
}

const buildEslintInstance = (
  root: string,
  customRules?: Record<string, 'error' | 'warn' | 'off'>,
): ESLint =>
  new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.astro'],
        plugins: { 'astro-doctor': astroDoctorPlugin },
        languageOptions: {
          parser: astroParser,
          parserOptions: { sourceType: 'module' },
        },
        rules: {
          ...astroDoctorPlugin.configs.recommended?.rules,
          ...customRules,
        },
      },
    ],
    ignore: false,
  })

interface LintResult {
  readonly lsp: LspDiagnostic[]
  readonly astro: AstroDiagnostic[]
}

const lintFileContent = async (
  eslint: ESLint,
  content: string,
  filePath: string,
): Promise<LintResult> => {
  const results = await eslint.lintText(content, { filePath })
  const result = results[0]

  if (!result) return { lsp: [], astro: [] }

  const lsp: LspDiagnostic[] = []
  const astro: AstroDiagnostic[] = []

  for (const msg of result.messages) {
    if (!msg.ruleId) continue

    const startLine = Math.max(0, msg.line - 1)
    const startChar = Math.max(0, msg.column - 1)
    const endLine = msg.endLine === undefined ? startLine : Math.max(0, msg.endLine - 1)

    const endChar =
      msg.endColumn === undefined ? startChar + 1 : Math.max(0, msg.endColumn - 1)

    const shortName = msg.ruleId.replace('astro-doctor/', '')

    const ruleDocs = (
      astroDoctorPlugin.rules[shortName]?.meta as
        | { docs?: { url?: string } }
        | undefined
    )?.docs

    lsp.push({
      range: {
        start: { line: startLine, character: startChar },
        end: { line: endLine, character: endChar },
      },
      severity: eslintSeverityToLsp[msg.severity] ?? DiagnosticSeverity.Warning,
      code: msg.ruleId,
      codeDescription: ruleDocs?.url ? { href: ruleDocs.url } : undefined,
      source: 'astro-doctor',
      message: msg.message,
    })

    astro.push({
      ruleId: msg.ruleId,
      severity: eslintSeverityToAstro[msg.severity] ?? 'warning',
      message: msg.message,
      filePath,
      line: msg.line,
      column: msg.column,
      category: getRuleCategory(msg.ruleId),
    })
  }

  return { lsp, astro }
}

export const runLsp = (): void => {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  let workspaceRoot = process.cwd()
  let eslintInstance: ESLint | null = null
  let scanOnType = true
  let workspaceFileCount = 0
  let config: AstroDoctorConfig | null = null
  // Keyed by absolute file path
  const fileAstroDiagnostics = new Map<string, AstroDiagnostic[]>()
  // Keyed by document URI (file://...)
  const fileLspDiagnostics = new Map<string, LspDiagnostic[]>()

  const sendStatus = (params: ServerStatusParams): void => {
    void connection.sendNotification(SERVER_STATUS_METHOD, params)
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
    void connection.sendNotification(HEALTH_SCORE_METHOD, computeHealthScore())
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

    void connection.sendNotification(TOP_ISSUES_METHOD, topIssues)
  }

  const doInitialScan = async (): Promise<void> => {
    sendStatus({ health: 'ok', quiescent: false, message: 'Scanning workspace…' })

    try {
      config = await loadConfig(workspaceRoot)

      eslintInstance = buildEslintInstance(workspaceRoot, config?.rules)

      const result = await scan({
        directory: workspaceRoot,
        ignore: config?.ignore,
        rules: config?.rules,
      })

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

        const lspDiags: LspDiagnostic[] = diags.map((d) => {
          const shortName = d.ruleId.replace('astro-doctor/', '')

          const ruleDocs = (
            astroDoctorPlugin.rules[shortName]?.meta as
              | { docs?: { url?: string } }
              | undefined
          )?.docs

          return {
            range: {
              start: { line: Math.max(0, d.line - 1), character: Math.max(0, d.column - 1) },
              end: { line: Math.max(0, d.line - 1), character: Math.max(0, d.column - 1) + 1 },
            },
            severity:
              d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
            code: d.ruleId,
            codeDescription: ruleDocs?.url ? { href: ruleDocs.url } : undefined,
            source: 'astro-doctor',
            message: d.message,
          }
        })

        fileLspDiagnostics.set(uri, lspDiags)

        void connection.sendDiagnostics({ uri, diagnostics: lspDiags })
      }

      publishHealthScore()

      publishTopIssues()

      sendStatus({ health: 'ok', quiescent: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      sendStatus({ health: 'error', quiescent: true, message: `Scan failed: ${message}` })
    }
  }

  const lintDocument = async (document: TextDocument): Promise<void> => {
    if (!eslintInstance) return

    let filePath: string

    try {
      filePath = fileURLToPath(document.uri)
    } catch {
      return
    }

    if (!filePath.endsWith('.astro')) return

    sendStatus({ health: 'ok', quiescent: false })

    try {
      const { lsp, astro } = await lintFileContent(
        eslintInstance,
        document.getText(),
        filePath,
      )

      // Update state — add to workspace file count if this is a new file
      if (!fileAstroDiagnostics.has(filePath)) {
        workspaceFileCount++
      }

      fileAstroDiagnostics.set(filePath, astro)

      fileLspDiagnostics.set(document.uri, lsp)

      void connection.sendDiagnostics({ uri: document.uri, diagnostics: lsp })

      publishHealthScore()

      publishTopIssues()

      sendStatus({ health: 'ok', quiescent: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      sendStatus({ health: 'warning', quiescent: true, message: `Lint failed: ${message}` })
    }
  }

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    const folderUri = params.workspaceFolders?.[0]?.uri ?? ''

    if (folderUri) {
      workspaceRoot = folderUri.startsWith('file://') ? fileURLToPath(folderUri) : folderUri
    }

    const options = params.initializationOptions as { scanOnType?: boolean } | undefined

    scanOnType = options?.scanOnType ?? true

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        hoverProvider: true,
        executeCommandProvider: {
          commands: ['astro-doctor.scanWorkspace'],
        },
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix],
        },
      },
    }
  })

  connection.onInitialized((): void => {
    void doInitialScan()
  })

  connection.onExecuteCommand(({ command }): void => {
    if (command === 'astro-doctor.scanWorkspace') void doInitialScan()
  })

  documents.onDidOpen(({ document }) => {
    void lintDocument(document)
  })

  documents.onDidChangeContent(({ document }) => {
    if (scanOnType) void lintDocument(document)
  })

  documents.onDidSave(({ document }) => {
    if (!scanOnType) void lintDocument(document)
  })

  documents.onDidClose(({ document }) => {
    // Clear LSP diagnostics but keep AstroDiagnostics for the health score
    fileLspDiagnostics.delete(document.uri)

    void connection.sendDiagnostics({ uri: document.uri, diagnostics: [] })
  })

  connection.onHover(({ textDocument, position }) => {
    const diags = fileLspDiagnostics.get(textDocument.uri) ?? []

    const diag = diags.find(
      (d) =>
        position.line >= d.range.start.line &&
        position.line <= d.range.end.line &&
        position.character >= d.range.start.character &&
        position.character <= d.range.end.character,
    )

    if (!diag || typeof diag.code !== 'string') return null

    const shortName = diag.code.replace('astro-doctor/', '')

    const ruleMeta = astroDoctorPlugin.rules[shortName]?.meta as
      | { docs?: { description?: string; url?: string }; messages?: Record<string, string> }
      | undefined

    const category = getRuleCategory(diag.code)
    const description = ruleMeta?.docs?.description ?? diag.message
    const docsUrl = ruleMeta?.docs?.url

    const lines = [
      `**\`${diag.code}\`** _(${category})_`,
      '',
      description,
    ]

    if (docsUrl) lines.push('', `[View documentation →](${docsUrl})`)

    return {
      contents: { kind: 'markdown', value: lines.join('\n') },
      range: diag.range,
    }
  })

  connection.onCodeAction(({ textDocument, context }) => {
    const actions: CodeAction[] = []

    for (const diag of context.diagnostics) {
      if (diag.source !== 'astro-doctor' || typeof diag.code !== 'string') continue

      const shortName = diag.code.replace('astro-doctor/', '')

      const ruleDocs = (
        astroDoctorPlugin.rules[shortName]?.meta as
          | { docs?: { url?: string } }
          | undefined
      )?.docs

      // Disable rule for this line
      const line = diag.range.start.line

      actions.push({
        title: `Disable ${diag.code} for this line`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [textDocument.uri]: [
              {
                range: { start: { line, character: 0 }, end: { line, character: 0 } },
                newText: `// eslint-disable-next-line ${diag.code}\n`,
              },
            ],
          },
        },
      })

      // Open documentation
      if (ruleDocs?.url) {
        actions.push({
          title: `Open documentation for ${diag.code}`,
          kind: CodeActionKind.Empty,
          command: {
            title: `Open documentation for ${diag.code}`,
            command: 'astro-doctor.openDocs',
            arguments: [ruleDocs.url],
          },
        })
      }
    }

    return actions
  })

  documents.listen(connection)

  connection.listen()
}
