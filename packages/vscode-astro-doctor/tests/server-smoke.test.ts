import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, test } from 'vitest'

import { SERVER_RESPONSE_TIMEOUT_MS, SERVER_TEST_TIMEOUT_MS } from './constants.js'

const SERVER_RESPONSE_ID = 'astro-doctor-server-smoke'

test('bundled language server initializes and diagnoses TypeScript and malformed buffers', async () => {
  const workspaceDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-editor-'))
  const documentPath = join(workspaceDirectory, 'index.astro')
  const content = '---\nconst token: string = process.env.SECRET\n---\n<img src="/hero.png" />'
  const documentUri = pathToFileURL(documentPath).toString()

  writeFileSync(documentPath, content)
  const serverPath = resolve(import.meta.dirname, '../dist/server.mjs')
  const serverProcess = spawn(process.execPath, [serverPath, '--stdio'], {
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-warnings`.trim(),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const requestBody = JSON.stringify({
    id: SERVER_RESPONSE_ID,
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      capabilities: {},
      processId: null,
      workspaceFolders: [{ uri: pathToFileURL(workspaceDirectory).toString(), name: 'fixture' }],
    },
  })

  try {
    const response = await new Promise<string>((resolve, reject) => {
      let errorOutput = ''
      let output = ''
      const responseTimeout = setTimeout(() => {
        const errorDetails = errorOutput.trim()
        const errorSuffix = errorDetails ? `\n${errorDetails}` : ''

        reject(
          new Error(
            `Bundled language server did not initialize within ${String(SERVER_RESPONSE_TIMEOUT_MS)}ms.${errorSuffix}`,
          ),
        )
      }, SERVER_RESPONSE_TIMEOUT_MS)

      const rejectWithCleanup = (error: Error): void => {
        clearTimeout(responseTimeout)
        reject(error)
      }

      serverProcess.stdout.on('data', (outputChunk: Buffer) => {
        output += outputChunk.toString()

        if (output.includes(`"id":"${SERVER_RESPONSE_ID}"`)) {
          clearTimeout(responseTimeout)
          resolve(output)
        }
      })
      serverProcess.stderr.on('data', (outputChunk: Buffer) => {
        errorOutput += outputChunk.toString()
      })
      serverProcess.once('error', rejectWithCleanup)
      serverProcess.once('exit', exitCode => {
        clearTimeout(responseTimeout)
        const errorDetails = errorOutput.trim()
        const errorSuffix = errorDetails ? `\n${errorDetails}` : ''

        reject(
          new Error(
            `Bundled language server exited before initialization with code ${String(exitCode)}.${errorSuffix}`,
          ),
        )
      })

      serverProcess.stdin.write(
        `Content-Length: ${Buffer.byteLength(requestBody)}\r\n\r\n${requestBody}`,
      )
    })

    expect(response).toContain(`"id":"${SERVER_RESPONSE_ID}"`)
    expect(response).toContain('"capabilities"')
    expect(response).toContain('"textDocumentSync":2')

    const expectDiagnostics = async (request: string, diagnosticCode: string): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        let output = ''
        const onData = (chunk: Buffer): void => {
          output += chunk.toString()
          if (!output.includes('textDocument/publishDiagnostics') || !output.includes(diagnosticCode)) return
          clearTimeout(timeout)
          serverProcess.stdout.off('data', onData)
          resolve()
        }
        const timeout = setTimeout(() => {
          serverProcess.stdout.off('data', onData)
          reject(new Error(`Missing editor diagnostic: ${diagnosticCode}. ${output}`))
        }, SERVER_RESPONSE_TIMEOUT_MS)

        serverProcess.stdout.on('data', onData)
        serverProcess.stdin.write(`Content-Length: ${Buffer.byteLength(request)}\r\n\r\n${request}`)
      })
    }

    const initialized = JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} })

    serverProcess.stdin.write(`Content-Length: ${Buffer.byteLength(initialized)}\r\n\r\n${initialized}`)
    await expectDiagnostics(JSON.stringify({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: { textDocument: { uri: documentUri, languageId: 'astro', version: 1, text: content } },
    }), 'astro-doctor/no-process-env')
    await expectDiagnostics(JSON.stringify({
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: {
        textDocument: { uri: documentUri, version: 2 },
        contentChanges: [{ text: '---\nconst invalid = ;\n---\n<div />' }],
      },
    }), 'astro-doctor/parse-error')
  } finally {
    serverProcess.kill()
    rmSync(workspaceDirectory, { recursive: true, force: true })
  }
}, SERVER_TEST_TIMEOUT_MS)
