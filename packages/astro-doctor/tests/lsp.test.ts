import { describe, expect, test } from 'vitest'
import { DiagnosticSeverity } from 'vscode-languageserver/node'

import { buildCodeActionsForDiagnostic } from '../src/lsp.js'

describe('LSP code actions', () => {
  test('exposes rule suggestions alongside suppression and documentation actions', () => {
    const range = {
      start: { line: 2, character: 0 },
      end: { line: 2, character: 8 },
    }
    const actions = buildCodeActionsForDiagnostic('file:///workspace/index.astro', {
      range,
      severity: DiagnosticSeverity.Warning,
      code: 'astro-doctor/no-blocking-script',
      source: 'astro-doctor',
      message: 'Blocking script.',
      data: {
        suggestions: [{
          title: 'Add defer to preserve document execution order.',
          newText: ' defer',
          range,
        }],
      },
    })

    expect(actions.map((action) => action.title)).toEqual([
      'Add defer to preserve document execution order.',
      'Disable astro-doctor/no-blocking-script for this line',
      'Open documentation for astro-doctor/no-blocking-script',
    ])
    expect(actions[0]?.edit?.changes?.['file:///workspace/index.astro']?.[0]?.newText)
      .toBe(' defer')
  })

  test('marks an automatic fix as preferred', () => {
    const range = {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 11 },
    }
    const actions = buildCodeActionsForDiagnostic('file:///workspace/index.astro', {
      range,
      code: 'astro-doctor/no-process-env',
      source: 'astro-doctor',
      message: 'Use import.meta.env.',
      data: {
        fix: {
          newText: 'import.meta.env',
          range,
        },
      },
    })

    expect(actions[0]).toEqual(
      expect.objectContaining({
        title: 'Fix astro-doctor/no-process-env',
        isPreferred: true,
      }),
    )
  })

  test('ignores diagnostics from other language servers', () => {
    expect(buildCodeActionsForDiagnostic('file:///workspace/index.astro', {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
      source: 'astro',
      message: 'Other diagnostic.',
    })).toEqual([])
  })
})
