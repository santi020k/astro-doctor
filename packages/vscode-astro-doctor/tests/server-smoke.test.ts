import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

import { expect, test } from 'vitest'

const SERVER_RESPONSE_ID = 'astro-doctor-server-smoke'

test('bundled language server starts and responds to initialize', async () => {
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
      rootUri: null,
    },
  })

  serverProcess.stdin.write(`Content-Length: ${Buffer.byteLength(requestBody)}\r\n\r\n${requestBody}`)

  try {
    const response = await new Promise<string>((resolve, reject) => {
      let errorOutput = ''
      let output = ''

      serverProcess.stdout.on('data', (outputChunk: Buffer) => {
        output += outputChunk.toString()

        if (output.includes(`"id":"${SERVER_RESPONSE_ID}"`)) resolve(output)
      })
      serverProcess.stderr.on('data', (outputChunk: Buffer) => {
        errorOutput += outputChunk.toString()
      })
      serverProcess.once('error', reject)
      serverProcess.once('exit', exitCode => {
        const errorDetails = errorOutput.trim()
        const errorSuffix = errorDetails ? `\n${errorDetails}` : ''

        reject(
          new Error(
            `Bundled language server exited before initialization with code ${String(exitCode)}.${errorSuffix}`,
          ),
        )
      })
    })

    expect(response).toContain(`"id":"${SERVER_RESPONSE_ID}"`)
    expect(response).toContain('"capabilities"')
    expect(response).toContain('"textDocumentSync":2')
  } finally {
    serverProcess.kill()
  }
})
