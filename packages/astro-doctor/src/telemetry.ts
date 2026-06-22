import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { TELEMETRY_REQUEST_TIMEOUT_MS } from './constants.js'
import type { ScanResult } from './types.js'

/**
 * Anonymous telemetry for Astro Doctor.
 *
 * What we collect (no file contents, no paths, no diagnostic messages):
 *   - CLI version, Node.js version, OS platform
 *   - Which command was run (scan, install, why, rules, init, lsp)
 *   - Whether --project, --staged, --diff, --preset were used (boolean flags only)
 *   - File count, error count, warning count, overall score
 *   - Rule IDs that fired and their counts (rule names only, not code)
 *
 * Opt out:
 *   --no-telemetry flag, or ASTRO_DOCTOR_NO_TELEMETRY=1 environment variable.
 *
 * Endpoint:
 *   Controlled by ASTRO_DOCTOR_TELEMETRY_URL. If unset, telemetry is silently skipped.
 */

interface TelemetryPayload {
  readonly version: string
  readonly node: string
  readonly platform: string
  readonly command: string
  readonly flags: Record<string, boolean>
  readonly fileCount: number
  readonly errorCount: number
  readonly warningCount: number
  readonly score: number
  readonly ruleHits: Record<string, number>
  readonly ci: boolean
}

const noop = (): void => {
  // intentionally swallows errors from fire-and-forget calls
}

const getVersion = (): string => {
  try {
    const require = createRequire(fileURLToPath(import.meta.url))
    const packageJson = require('../../package.json') as { version: string }

    return packageJson.version
  } catch {
    return '0.0.0'
  }
}

const isCI = (): boolean =>
  Boolean(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.BUILDKITE,
  )

const buildRuleHits = (result: ScanResult): Record<string, number> => {
  const counts: Record<string, number> = {}

  for (const diagnostic of result.diagnostics) {
    const rule = diagnostic.ruleId

    counts[rule] = (counts[rule] ?? 0) + 1
  }

  return counts
}

export interface TelemetryOptions {
  readonly command: string
  readonly flags: Record<string, boolean>
  readonly result?: ScanResult
}

const buildPayload = (options: TelemetryOptions): TelemetryPayload => ({
  version: getVersion(),
  node: process.version,
  platform: process.platform,
  command: options.command,
  flags: options.flags,
  fileCount: options.result?.fileCount ?? 0,
  errorCount: options.result?.errorCount ?? 0,
  warningCount: options.result?.warningCount ?? 0,
  score: options.result?.score ?? 100,
  ruleHits: options.result ? buildRuleHits(options.result) : {},
  ci: isCI(),
})

const sendTelemetry = async (endpoint: string, payload: TelemetryPayload): Promise<void> => {
  try {
    const controller = new AbortController()

    const timeoutId = setTimeout(() => {
      controller.abort()
    }, TELEMETRY_REQUEST_TIMEOUT_MS)

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
  } catch {
    // Silently ignore — telemetry must never cause CLI failures
  }
}

/**
 * Fire-and-forget telemetry ping. Never throws, never blocks the CLI.
 *
 * Returns immediately — the actual HTTP request runs in the background.
 * If the endpoint is unreachable or the request times out, it is silently ignored.
 */
export const trackRun = (options: TelemetryOptions, disabled: boolean): void => {
  if (disabled) return

  const endpoint = process.env.ASTRO_DOCTOR_TELEMETRY_URL

  if (!endpoint) return

  sendTelemetry(endpoint, buildPayload(options)).catch(noop)
}
