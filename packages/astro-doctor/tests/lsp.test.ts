import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

import { ESLint } from 'eslint'
import { describe, expect, test } from 'vitest'
import { DiagnosticSeverity } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import {
  buildCodeActionsForDiagnostic,
  getFixedDocumentText,
  LSP_EXECUTE_COMMANDS
} from '../src/lsp.js'

describe('LSP commands', () => {
  test('advertises current-file scanning', () => {
    expect(LSP_EXECUTE_COMMANDS).toContain('astro-doctor.scanFile')
  })

  test('uses ESLint multipass output for safe document fixes', async () => {
    let nextReplacement = 'second'
    const eslint = new ESLint({
      fix: true,
      overrideConfigFile: true,
      overrideConfig: [{
        files: ['**/*.js'],
        plugins: {
          test: {
            rules: {
              'multipass-fix': {
                create: context => ({
                  Program: programNode => {
                    if (nextReplacement === 'done') return

                    const replacement = nextReplacement

                    nextReplacement = nextReplacement === 'second' ? 'final' : 'done'

                    context.report({
                      fix: fixer => fixer.replaceText(programNode, replacement),
                      messageId: 'replace',
                      node: programNode
                    })
                  }
                }),
                meta: {
                  fixable: 'code',
                  messages: {
                    replace: 'Replace content.'
                  },
                  schema: [],
                  type: 'problem'
                }
              }
            }
          }
        },
        rules: {
          'test/multipass-fix': 'error'
        }
      }]
    })

    await expect(getFixedDocumentText(eslint, 'first', `${process.cwd()}/example.js`))
      .resolves.toBe('final')
  })
})

describe('LSP code actions', () => {
  test('exposes rule suggestions and documentation without an unsafe template suppression', () => {
    const range = {
      start: { line: 2, character: 0 },
      end: { line: 2, character: 8 }
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
          range
        }]
      }
    })

    expect(actions.map(action => action.title)).toEqual([
      'Add defer to preserve document execution order.',
      'Open documentation for astro-doctor/no-blocking-script'
    ])
    expect(actions[0]?.edit?.changes?.['file:///workspace/index.astro']?.[0]?.newText)
      .toBe(' defer')
  })

  test('offers an effective suppression for JavaScript frontmatter', async () => {
    const content = '---\nconst secret = process.env.SECRET\n---\n<div />'
    const documentUri = 'file:///workspace/index.astro'
    const actions = buildCodeActionsForDiagnostic(documentUri, {
      range: { start: { line: 1, character: 15 }, end: { line: 1, character: 26 } },
      code: 'astro-doctor/no-process-env',
      source: 'astro-doctor',
      message: 'Use import.meta.env.'
    }, content)
    const suppression = actions.find(action => action.title.startsWith('Disable '))
    const edits = suppression?.edit?.changes?.[documentUri]

    expect(edits).toBeDefined()
    if (!edits) throw new Error('Expected a frontmatter suppression edit')

    const modifiedContent = TextDocument.applyEdits(
      TextDocument.create(documentUri, 'astro', 0, content), edits
    )
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [{
        ...astroDoctorPlugin.configs.recommended,
        rules: { 'astro-doctor/no-process-env': 'error' }
      }]
    })
    const results = await eslint.lintText(modifiedContent, { filePath: 'index.astro' })

    expect(results[0]?.messages).toEqual([])
  })

  test('does not insert suppression text inside a multiline template literal', async () => {
    const content = '---\nconst text = `\n  ${process.env.SECRET}\n`\n---\n<div>{text}</div>'
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [{
        ...astroDoctorPlugin.configs.recommended,
        rules: { 'astro-doctor/no-process-env': 'error' }
      }]
    })
    const results = await eslint.lintText(content, { filePath: 'index.astro' })
    const message = results[0]?.messages.find(diagnostic => diagnostic.ruleId === 'astro-doctor/no-process-env')

    expect(message).toBeDefined()
    if (!message) throw new Error('Expected an environment diagnostic in the interpolation')

    const actions = buildCodeActionsForDiagnostic('file:///workspace/index.astro', {
      range: {
        start: { line: message.line - 1, character: message.column - 1 },
        end: { line: message.line - 1, character: message.column }
      },
      code: 'astro-doctor/no-process-env',
      source: 'astro-doctor',
      message: message.message
    }, content)

    expect(actions.some(action => action.title.startsWith('Disable '))).toBe(false)
    expect(actions.some(action => action.title.startsWith('Open documentation'))).toBe(true)
  })

  test.each([
    '<img src="/hero.png" />',
    '---\nconst broken = (\n---\n<img src="/hero.png" />'
  ])('does not insert JavaScript comments into templates or invalid documents', content => {
    const actions = buildCodeActionsForDiagnostic('file:///workspace/index.astro', {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      code: 'astro-doctor/no-missing-alt',
      source: 'astro-doctor',
      message: 'Missing alt.'
    }, content)

    expect(actions.some(action => action.title.startsWith('Disable '))).toBe(false)
  })

  test('marks an automatic fix as preferred', () => {
    const range = {
      start: { line: 1, character: 0 },
      end: { line: 1, character: 11 }
    }
    const actions = buildCodeActionsForDiagnostic('file:///workspace/index.astro', {
      range,
      code: 'astro-doctor/no-process-env',
      source: 'astro-doctor',
      message: 'Use import.meta.env.',
      data: {
        fix: {
          newText: 'import.meta.env',
          range
        }
      }
    })

    expect(actions[0]).toEqual(
      expect.objectContaining({
        title: 'Fix astro-doctor/no-process-env',
        isPreferred: true
      })
    )
  })

  test('ignores diagnostics from other language servers', () => {
    expect(buildCodeActionsForDiagnostic('file:///workspace/index.astro', {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 }
      },
      source: 'astro',
      message: 'Other diagnostic.'
    })).toEqual([])
  })
})
