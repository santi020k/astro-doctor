import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

import { scan } from './scanner/index.js'
import { createScanResult } from './utils/create-scan-result.js'
import { PERSISTENT_BASELINE_VERSION } from './constants.js'
import { getFileAtRevision } from './git.js'
import type { Diagnostic, ScanOptions, ScanResult } from './types.js'

interface BaselineScanOptions {
  readonly repositoryDirectory: string
  readonly projectDirectory: string
  readonly files: readonly string[]
  readonly baseRevision: string
  readonly scanOptions: Omit<ScanOptions, 'directory' | 'files' | 'fix'>
}

interface BaselineSnapshot {
  readonly directory: string
  readonly projectDirectory: string
  readonly files: readonly string[]
}

export interface BaselineScanResult {
  readonly result: ScanResult
  readonly rootDirectory: string
}

interface PersistentBaselineEntry {
  readonly fingerprint: string
  readonly count: number
}

export interface PersistentBaseline {
  readonly $schema: string
  readonly version: number
  readonly generatedAt: string
  readonly entries: readonly PersistentBaselineEntry[]
}

const PERSISTENT_BASELINE_SCHEMA_URL = 'https://doctor.santi020k.com/schema/baseline.json'

const createBaselineSnapshot = (options: BaselineScanOptions): BaselineSnapshot => {
  const snapshotDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-baseline-'))
  const projectPath = relative(options.repositoryDirectory, options.projectDirectory)
  const snapshotProjectDirectory = resolve(snapshotDirectory, projectPath)
  const snapshotFiles: string[] = []

  for (const filePath of options.files) {
    const repositoryPath = relative(options.repositoryDirectory, filePath).replaceAll('\\', '/')

    const content = getFileAtRevision(
      options.repositoryDirectory,
      options.baseRevision,
      repositoryPath,
    )

    if (content === undefined) continue

    const snapshotFilePath = resolve(snapshotDirectory, repositoryPath)

    mkdirSync(dirname(snapshotFilePath), { recursive: true })

    writeFileSync(snapshotFilePath, content, 'utf8')

    snapshotFiles.push(snapshotFilePath)
  }

  return {
    directory: snapshotDirectory,
    projectDirectory: snapshotProjectDirectory,
    files: snapshotFiles,
  }
}

export const scanBaseline = async (options: BaselineScanOptions): Promise<BaselineScanResult> => {
  const snapshot = createBaselineSnapshot(options)

  try {
    const result = await scan({
      ...options.scanOptions,
      directory: snapshot.projectDirectory,
      files: snapshot.files,
      fix: false,
    })

    return {
      result,
      rootDirectory: snapshot.projectDirectory,
    }
  } finally {
    rmSync(snapshot.directory, { recursive: true, force: true })
  }
}

const getDiagnosticFingerprint = (
  diagnostic: Diagnostic,
  rootDirectory: string,
): string => [
  relative(rootDirectory, diagnostic.filePath).replaceAll('\\', '/'),
  diagnostic.ruleId,
  diagnostic.severity,
  diagnostic.message,
].join('\0')

const createFingerprintCounts = (
  diagnostics: readonly Diagnostic[],
  rootDirectory: string,
): Map<string, number> => {
  const fingerprintCounts = new Map<string, number>()

  for (const diagnostic of diagnostics) {
    const fingerprint = getDiagnosticFingerprint(diagnostic, rootDirectory)

    fingerprintCounts.set(fingerprint, (fingerprintCounts.get(fingerprint) ?? 0) + 1)
  }

  return fingerprintCounts
}

export const createPersistentBaseline = (
  result: ScanResult,
  rootDirectory: string,
): PersistentBaseline => ({
  $schema: PERSISTENT_BASELINE_SCHEMA_URL,
  version: PERSISTENT_BASELINE_VERSION,
  generatedAt: new Date().toISOString(),
  entries: [...createFingerprintCounts(result.diagnostics, rootDirectory)]
    .sort(([firstFingerprint], [secondFingerprint]) =>
      firstFingerprint.localeCompare(secondFingerprint)
    )
    .map(([fingerprint, count]) => ({ fingerprint, count })),
})

export const writePersistentBaseline = (
  filePath: string,
  baseline: PersistentBaseline,
): void => {
  mkdirSync(dirname(filePath), { recursive: true })

  writeFileSync(filePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
}

const isPersistentBaselineEntry = (value: unknown): value is PersistentBaselineEntry => {
  if (typeof value !== 'object' || value === null) return false

  const entry = value as Record<string, unknown>

  return typeof entry.fingerprint === 'string' &&
    typeof entry.count === 'number' &&
    Number.isInteger(entry.count) &&
    entry.count > 0
}

export const readPersistentBaseline = (filePath: string): PersistentBaseline => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))

  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError('Baseline must contain a JSON object.')
  }

  const baseline = parsed as Record<string, unknown>

  if (baseline.version !== PERSISTENT_BASELINE_VERSION) {
    throw new Error(
      `Unsupported baseline version "${String(baseline.version)}". Expected ${PERSISTENT_BASELINE_VERSION}.`,
    )
  }

  if (typeof baseline.generatedAt !== 'string') {
    throw new TypeError('Baseline generatedAt must be a string.')
  }

  if (!Array.isArray(baseline.entries) || !baseline.entries.every(isPersistentBaselineEntry)) {
    throw new TypeError('Baseline entries must contain valid fingerprint counts.')
  }

  return {
    $schema: typeof baseline.$schema === 'string'
      ? baseline.$schema
      : PERSISTENT_BASELINE_SCHEMA_URL,
    version: PERSISTENT_BASELINE_VERSION,
    generatedAt: baseline.generatedAt,
    entries: baseline.entries,
  }
}

export const filterPersistentBaselineDiagnostics = (
  result: ScanResult,
  baseline: PersistentBaseline,
  rootDirectory: string,
): ScanResult => {
  const baselineCounts = new Map(
    baseline.entries.map((entry) => [entry.fingerprint, entry.count]),
  )

  const diagnostics = result.diagnostics.filter((diagnostic) => {
    const fingerprint = getDiagnosticFingerprint(diagnostic, rootDirectory)
    const count = baselineCounts.get(fingerprint) ?? 0

    if (count === 0) return true

    baselineCounts.set(fingerprint, count - 1)

    return false
  })

  return {
    ...createScanResult(diagnostics, result.fileCount),
    timings: result.timings,
  }
}

export const filterIntroducedDiagnostics = (
  currentResult: ScanResult,
  baselineResult: ScanResult,
  currentRootDirectory: string,
  baselineRootDirectory: string,
): ScanResult => {
  const baselineCounts = createFingerprintCounts(
    baselineResult.diagnostics,
    baselineRootDirectory,
  )

  const introducedDiagnostics = currentResult.diagnostics.filter((diagnostic) => {
    const fingerprint = getDiagnosticFingerprint(diagnostic, currentRootDirectory)
    const baselineCount = baselineCounts.get(fingerprint) ?? 0

    if (baselineCount === 0) return true

    baselineCounts.set(fingerprint, baselineCount - 1)

    return false
  })

  return createScanResult(introducedDiagnostics, currentResult.fileCount)
}
