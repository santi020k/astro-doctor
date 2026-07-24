import { createHash } from 'node:crypto'
import { relative } from 'node:path'

import type { AstroDoctorRule } from '@santi020k/eslint-plugin-astro-doctor'
import astroDoctorPlugin, {
  getAstroRuleCategory,
  getAstroRuleDescription,
  getAstroRuleDocUrl,
} from '@santi020k/eslint-plugin-astro-doctor'

import type { Diagnostic, ScanResult } from '../types.js'
import { getPackageVersion } from '../utils/get-package-version.js'

const SARIF_SCHEMA_URL = 'https://json.schemastore.org/sarif-2.1.0.json'
const SARIF_VERSION = '2.1.0'

interface SarifRule {
  readonly id: string
  readonly name: string
  readonly shortDescription: {
    readonly text: string
  }
  readonly helpUri?: string
  readonly properties: {
    readonly category: string
  }
}

interface SarifResult {
  readonly ruleId: string
  readonly level: 'error' | 'warning'
  readonly message: {
    readonly text: string
  }
  readonly locations: readonly [{
    readonly physicalLocation: {
      readonly artifactLocation: {
        readonly uri: string
      }
      readonly region: {
        readonly startLine: number
        readonly startColumn: number
      }
    }
  }]
  readonly partialFingerprints: {
    readonly astroDoctorFingerprint: string
  }
}

export interface SarifReport {
  readonly $schema: string
  readonly version: string
  readonly runs: readonly [{
    readonly tool: {
      readonly driver: {
        readonly name: string
        readonly version: string
        readonly informationUri: string
        readonly rules: readonly SarifRule[]
      }
    }
    readonly results: readonly SarifResult[]
    readonly properties: {
      readonly score: number
      readonly scoreLabel: string
      readonly fileCount: number
    }
  }]
}

const normalizePath = (filePath: string): string => filePath.replaceAll('\\', '/')

const createFingerprint = (diagnostic: Diagnostic, rootDirectory: string): string =>
  createHash('sha256')
    .update([
      normalizePath(relative(rootDirectory, diagnostic.filePath)),
      diagnostic.ruleId,
      diagnostic.message,
    ].join('\0'))
    .digest('hex')

const formatRule = (ruleId: string): SarifRule => {
  const ecosystemCategory = getAstroRuleCategory(ruleId)
  const ecosystemDescription = getAstroRuleDescription(ruleId)
  const ecosystemRuleUrl = getAstroRuleDocUrl(ruleId)
  const shortName = ruleId.replace('astro-doctor/', '')
  const rule = astroDoctorPlugin.rules[shortName] as AstroDoctorRule | undefined
  const helpUri = ecosystemRuleUrl ?? rule?.meta.docs.url

  const formattedRule: SarifRule = {
    id: ruleId,
    name: shortName,
    shortDescription: {
      text: ecosystemDescription ?? rule?.meta.docs.description ?? shortName,
    },
    properties: {
      category: ecosystemCategory ?? rule?.meta.docs.category ?? 'best-practices',
    },
  }

  return helpUri === undefined
    ? formattedRule
    : { ...formattedRule, helpUri }
}

const formatResult = (diagnostic: Diagnostic, rootDirectory: string): SarifResult => ({
  ruleId: diagnostic.ruleId,
  level: diagnostic.severity,
  message: {
    text: diagnostic.message,
  },
  locations: [{
    physicalLocation: {
      artifactLocation: {
        uri: normalizePath(relative(rootDirectory, diagnostic.filePath)),
      },
      region: {
        startLine: diagnostic.line,
        startColumn: diagnostic.column,
      },
    },
  }],
  partialFingerprints: {
    astroDoctorFingerprint: createFingerprint(diagnostic, rootDirectory),
  },
})

export const formatSarifReport = (
  result: ScanResult,
  rootDirectory: string,
): SarifReport => {
  const ruleIds = [...new Set(result.diagnostics.map((diagnostic) => diagnostic.ruleId))].sort()

  return {
    $schema: SARIF_SCHEMA_URL,
    version: SARIF_VERSION,
    runs: [{
      tool: {
        driver: {
          name: 'Astro Doctor',
          version: getPackageVersion(),
          informationUri: 'https://doctor.santi020k.com',
          rules: ruleIds.map(formatRule),
        },
      },
      results: result.diagnostics.map((diagnostic) => formatResult(diagnostic, rootDirectory)),
      properties: {
        score: result.score,
        scoreLabel: result.scoreLabel,
        fileCount: result.fileCount,
      },
    }],
  }
}

export const serializeSarifReport = (report: SarifReport, compact: boolean): string =>
  compact ? JSON.stringify(report) : JSON.stringify(report, null, 2)
