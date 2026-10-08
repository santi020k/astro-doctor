import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { readPnpmWorkspacePatterns } from '../../src/utils/read-pnpm-workspace-patterns.js'

describe('readPnpmWorkspacePatterns', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-pnpm-workspace-patterns-'))
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  const writeWorkspaceFile = (content: string): void => {
    writeFileSync(join(testDirectory, 'pnpm-workspace.yaml'), content, 'utf8')
  }

  test('returns an empty array when pnpm-workspace.yaml does not exist', () => {
    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual([])
  })

  test('reads block-style packages patterns', () => {
    writeWorkspaceFile([
      'packages:',
      '  - \'packages/*\'',
      '  - apps/*',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual(['packages/*', 'apps/*'])
  })

  test('reads inline flow-style packages arrays', () => {
    writeWorkspaceFile('packages: [\'packages/*\', \'apps/*\']\n')

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual(['packages/*', 'apps/*'])
  })

  test('strips quoting and trailing comments the same way the YAML parser does', () => {
    writeWorkspaceFile([
      'packages:',
      '  - \'packages/*\' # single-quoted',
      '  - "apps/*" # double-quoted',
      '  - tools/* # unquoted',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual(['packages/*', 'apps/*', 'tools/*'])
  })

  test('preserves quoted negation patterns unmodified', () => {
    writeWorkspaceFile([
      'packages:',
      '  - \'packages/*\'',
      '  - \'!packages/excluded\'',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual(['packages/*', '!packages/excluded'])
  })

  test('ignores sibling list keys such as supportedArchitectures and minimumReleaseAgeExclude', () => {
    writeWorkspaceFile([
      'packages:',
      '  - \'packages/*\'',
      '  - \'apps/*\'',
      'minimumReleaseAgeExclude:',
      '  - \'@scope/package\'',
      '  - js-yaml@4.3.2',
      'supportedArchitectures:',
      '  cpu:',
      '    - current',
      '    - wasm32',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual(['packages/*', 'apps/*'])
  })

  test('returns an empty array when the packages key is missing', () => {
    writeWorkspaceFile([
      'catalog:',
      '  astro: ^7.0.0',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual([])
  })

  test('returns an empty array when packages is not an array', () => {
    writeWorkspaceFile([
      'packages: "packages/*"',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual([])
  })

  test('returns an empty array when packages contains non-string entries', () => {
    writeWorkspaceFile([
      'packages:',
      '  - \'packages/*\'',
      '  - 42',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual([])
  })

  test('returns an empty array for malformed YAML instead of throwing', () => {
    writeWorkspaceFile([
      'packages:',
      '  - [unterminated flow sequence',
      ''
    ].join('\n'))

    expect(() => readPnpmWorkspacePatterns(testDirectory)).not.toThrow()
    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual([])
  })

  test('returns an empty array when the document top level is not an object', () => {
    writeWorkspaceFile([
      '- packages/*',
      '- apps/*',
      ''
    ].join('\n'))

    expect(readPnpmWorkspacePatterns(testDirectory)).toEqual([])
  })
})
