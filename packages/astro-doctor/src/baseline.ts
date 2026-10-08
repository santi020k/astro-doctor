import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

import { scan } from './scanner/index.js'
import { createScanResult } from './utils/create-scan-result.js'
import { isPlainObject } from './utils/is-plain-object.js'
import { PERSISTENT_BASELINE_VERSION } from './constants.js'
import { extractRevision } from './git.js'
import type { Diagnostic, ScanOptions, ScanResult } from './types.js'

interface BaselineScanOptions {
  readonly repositoryDirectory: string
  readonly projectDirectory: string
  readonly files: readonly string[]
  readonly baseRevision: string
  readonly scanOptions: Omit<ScanOptions, 'directory' | 'files' | 'fix'>
}

interface BaselineSnapshot {
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

const createBaselineSnapshot = (
  options: BaselineScanOptions,
  snapshotDirectory: string
): BaselineSnapshot => {
  const projectPath = relative(options.repositoryDirectory, options.projectDirectory)
  const snapshotProjectDirectory = resolve(snapshotDirectory, projectPath)
  const snapshotFiles: string[] = []

  extractRevision(options.repositoryDirectory, options.baseRevision, snapshotDirectory)

  mkdirSync(snapshotProjectDirectory, { recursive: true })

  for (const filePath of options.files) {
    const repositoryPath = relative(options.repositoryDirectory, filePath).replaceAll('\\', '/')
    const snapshotFilePath = resolve(snapshotDirectory, repositoryPath)

    if (!existsSync(snapshotFilePath)) continue

    snapshotFiles.push(snapshotFilePath)
  }

  return {
    projectDirectory: snapshotProjectDirectory,
    files: snapshotFiles
  }
}

export const scanBaseline = async (options: BaselineScanOptions): Promise<BaselineScanResult> => {
  const snapshotDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-baseline-'))

  try {
    const snapshot = createBaselineSnapshot(options, snapshotDirectory)

    const result = await scan({
      ...options.scanOptions,
      directory: snapshot.projectDirectory,
      files: snapshot.files,
      fix: false,
      fixDryRun: false
    })

    return {
      result,
      rootDirectory: snapshot.projectDirectory
    }
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true })
  }
}

const getDiagnosticFingerprint = (
  diagnostic: Diagnostic,
  rootDirectory: string
): string => [
  relative(rootDirectory, diagnostic.filePath).replaceAll('\\', '/'),
  diagnostic.ruleId,
  diagnostic.severity,
  diagnostic.message
].join('\0')

const createFingerprintCounts = (
  diagnostics: readonly Diagnostic[],
  rootDirectory: string
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
  rootDirectory: string
): PersistentBaseline => ({
  $schema: PERSISTENT_BASELINE_SCHEMA_URL,
  version: PERSISTENT_BASELINE_VERSION,
  generatedAt: new Date().toISOString(),
  entries: [...createFingerprintCounts(result.diagnostics, rootDirectory)]
    .sort(([firstFingerprint], [secondFingerprint]) => firstFingerprint.localeCompare(secondFingerprint))
    .map(([fingerprint, count]) => ({ fingerprint, count }))
})

export const writePersistentBaseline = (
  filePath: string,
  baseline: PersistentBaseline
): void => {
  mkdirSync(dirname(filePath), { recursive: true })

  const temporaryDirectory = mkdtempSync(join(dirname(filePath), '.astro-doctor-baseline-'))

  try {
    const temporaryPath = join(temporaryDirectory, 'baseline.json')

    writeFileSync(temporaryPath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')

    renameSync(temporaryPath, filePath)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

const isPersistentBaselineEntry = (value: unknown): value is PersistentBaselineEntry => isPlainObject(value) &&
  typeof value.fingerprint === 'string' &&
  typeof value.count === 'number' &&
  Number.isInteger(value.count) &&
  value.count > 0

export const readPersistentBaseline = (filePath: string): PersistentBaseline => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))

  if (!isPlainObject(parsed)) {
    throw new TypeError('Baseline must contain a JSON object.')
  }

  const version = parsed.version

  if (version !== PERSISTENT_BASELINE_VERSION) {
    throw new Error(
      `Unsupported baseline version "${String(version)}". Expected ${PERSISTENT_BASELINE_VERSION}.`
    )
  }

  if (typeof parsed.generatedAt !== 'string') {
    throw new TypeError('Baseline generatedAt must be a string.')
  }

  if (!Array.isArray(parsed.entries) || !parsed.entries.every(isPersistentBaselineEntry)) {
    throw new TypeError('Baseline entries must contain valid fingerprint counts.')
  }

  const fingerprints = new Set(parsed.entries.map(entry => entry.fingerprint))

  if (fingerprints.size !== parsed.entries.length) {
    throw new Error('Baseline entries must have unique fingerprints.')
  }

  return {
    $schema: typeof parsed.$schema === 'string' ?
      parsed.$schema :
      PERSISTENT_BASELINE_SCHEMA_URL,
    version: PERSISTENT_BASELINE_VERSION,
    generatedAt: parsed.generatedAt,
    entries: parsed.entries
  }
}

const recountFixPreview = (result: ScanResult, diagnostics: readonly Diagnostic[]): Pick<ScanResult, 'fixPreview'> => result.fixPreview === undefined ?
  {} :
  { fixPreview: { ...result.fixPreview, remainingCount: diagnostics.length } }

export const filterPersistentBaselineDiagnostics = (
  result: ScanResult,
  baseline: PersistentBaseline,
  rootDirectory: string,
  fullComparison = true
): ScanResult => {
  const baselineCounts = new Map(
    baseline.entries.map(entry => [entry.fingerprint, entry.count])
  )

  const diagnostics = result.diagnostics.filter(diagnostic => {
    const fingerprint = getDiagnosticFingerprint(diagnostic, rootDirectory)
    const count = baselineCounts.get(fingerprint) ?? 0

    if (count === 0) return true

    baselineCounts.set(fingerprint, count - 1)

    return false
  })

  return {
    ...createScanResult(diagnostics, result.fileCount),
    timings: result.timings,
    ...recountFixPreview(result, diagnostics),
    baselineProgress: {
      newCount: diagnostics.length,
      existingCount: result.diagnostics.length - diagnostics.length,
      ...(fullComparison ?
        {
          resolvedCount: [...baselineCounts.values()].reduce((total, count) => total + count, 0)
        } :
        {})
    }
  }
}

export const filterIntroducedDiagnostics = (
  currentResult: ScanResult,
  baselineResult: ScanResult,
  currentRootDirectory: string,
  baselineRootDirectory: string
): ScanResult => {
  const baselineCounts = createFingerprintCounts(
    baselineResult.diagnostics, baselineRootDirectory
  )

  const introducedDiagnostics = currentResult.diagnostics.filter(diagnostic => {
    const fingerprint = getDiagnosticFingerprint(diagnostic, currentRootDirectory)
    const baselineCount = baselineCounts.get(fingerprint) ?? 0

    if (baselineCount === 0) return true

    baselineCounts.set(fingerprint, baselineCount - 1)

    return false
  })

  return {
    ...createScanResult(introducedDiagnostics, currentResult.fileCount),
    ...recountFixPreview(currentResult, introducedDiagnostics)
  }
}

export const prunePersistentBaseline = (
  result: ScanResult,
  baseline: PersistentBaseline,
  rootDirectory: string
): PersistentBaseline => {
  const currentCounts = createFingerprintCounts(result.diagnostics, rootDirectory)

  return {
    ...baseline,
    entries: baseline.entries.flatMap(entry => {
      const count = Math.min(entry.count, currentCounts.get(entry.fingerprint) ?? 0)

      return count > 0 ? [{ fingerprint: entry.fingerprint, count }] : []
    })
  }
}
