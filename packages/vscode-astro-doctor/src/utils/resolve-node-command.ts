import { execFile } from 'node:child_process'
import * as path from 'node:path'

import type * as vscode from 'vscode'

import { NODE_RESOLUTION_TIMEOUT_MILLISECONDS } from '../constants'

const resolveNodeFromShell = (shellPath: string): Promise<null | string> =>
  new Promise((resolve) => {
    execFile(
      shellPath,
      ['-ilc', 'command -v node'],
      {
        encoding: 'utf8',
        timeout: NODE_RESOLUTION_TIMEOUT_MILLISECONDS,
      },
      (error, standardOutput) => {
        if (error) {
          resolve(null)

          return
        }

        const nodeCommand = standardOutput
          .split(/\r?\n/)
          .map((outputLine) => outputLine.trim())
          .reverse()
          .find((outputLine) => path.isAbsolute(outputLine))

        resolve(nodeCommand ?? null)
      },
    )
  })

export const resolveNodeCommand = async (
  configuration: vscode.WorkspaceConfiguration,
  outputChannel: vscode.OutputChannel,
): Promise<string> => {
  const configuredNodePath = configuration.get<string>('nodePath', '').trim()

  if (configuredNodePath.length > 0) return configuredNodePath

  if (process.platform === 'win32') return 'node'

  const shellPath = process.env.SHELL?.trim()

  if (shellPath === undefined || shellPath.length === 0) return 'node'

  const nodeCommand = await resolveNodeFromShell(shellPath)

  if (nodeCommand === null) return 'node'

  outputChannel.appendLine(`Astro Doctor: resolved Node.js runtime at ${nodeCommand}`)

  return nodeCommand
}
