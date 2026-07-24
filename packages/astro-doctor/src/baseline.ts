import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

import { scan } from './scanner/index.js'
import { createScanResult } from './utils/create-scan-result.js'
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

export const filterIntroducedDiagnostics = (
  currentResult: ScanResult,
  baselineResult: ScanResult,
  currentRootDirectory: string,
  baselineRootDirectory: string,
): ScanResult => {
  const baselineCounts = new Map<string, number>()

  for (const diagnostic of baselineResult.diagnostics) {
    const fingerprint = getDiagnosticFingerprint(diagnostic, baselineRootDirectory)

    baselineCounts.set(fingerprint, (baselineCounts.get(fingerprint) ?? 0) + 1)
  }

  const introducedDiagnostics = currentResult.diagnostics.filter((diagnostic) => {
    const fingerprint = getDiagnosticFingerprint(diagnostic, currentRootDirectory)
    const baselineCount = baselineCounts.get(fingerprint) ?? 0

    if (baselineCount === 0) return true

    baselineCounts.set(fingerprint, baselineCount - 1)

    return false
  })

  return createScanResult(introducedDiagnostics, currentResult.fileCount)
}
