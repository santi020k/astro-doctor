import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { getPresetRules } from '../../src/presets.js'
import { scan } from '../../src/scanner/index.js'

describe('project audits', () => {
  let testDirectory: string

  beforeEach(() => {
    testDirectory = join(tmpdir(), `astro-doctor-project-audit-${Date.now()}`)
    mkdirSync(testDirectory, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true })
  })

  test('reports actions without a top-level input schema', async () => {
    mkdirSync(join(testDirectory, 'src', 'actions'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'src', 'actions', 'index.ts'),
      [
        "import { defineAction } from 'astro:actions'",
        "import { z } from 'astro:schema'",
        '',
        'export const server = {',
        '  unsafe: defineAction({',
        "    handler: async (input) => ({ nested: { input: 'not a schema' }, input }),",
        '  }),',
        '  safe: defineAction({',
        '    input: z.object({ name: z.string() }),',
        '    handler: async ({ name }) => ({ name }),',
        '  }),',
        '  logout: defineAction({',
        '    handler: async () => true,',
        '  }),',
        '  rawForm: defineAction({',
        "    accept: 'form',",
        '    handler: async (formData) => formData.get("name"),',
        '  }),',
        '}',
      ].join('\n'),
    )

    const scanResult = await scan({ directory: testDirectory })
    const actionDiagnostics = scanResult.diagnostics.filter(
      (diagnostic) => diagnostic.ruleId === 'astro-doctor/require-action-input-schema',
    )

    expect(actionDiagnostics).toHaveLength(1)
    expect(actionDiagnostics[0]).toMatchObject({
      severity: 'warning',
      line: 5,
      category: 'security',
    })
  })

  test('audits a selected action file without scanning unchanged actions', async () => {
    mkdirSync(join(testDirectory, 'src', 'actions'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'src', 'actions', 'changed.ts'),
      "import { defineAction as createAction } from 'astro:actions'\nexport const changed = createAction({ handler: async (input) => input })",
    )
    writeFileSync(
      join(testDirectory, 'src', 'actions', 'unchanged.ts'),
      "import { defineAction } from 'astro:actions'\nexport const unchanged = defineAction({ handler: async (input) => input })",
    )

    const scanResult = await scan({
      directory: testDirectory,
      files: ['src/actions/changed.ts'],
    })

    expect(scanResult.diagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'astro-doctor/require-action-input-schema',
        filePath: join(testDirectory, 'src', 'actions', 'changed.ts'),
      }),
    ])
  })

  test('reports explicit insecure session cookie overrides only inside session.cookie', async () => {
    writeFileSync(
      join(testDirectory, 'astro.config.ts'),
      [
        "import { defineConfig } from 'astro/config'",
        '',
        'export default defineConfig({',
        '  unrelated: { secure: false },',
        '  session: {',
        '    cookie: {',
        '      secure: false,',
        '      httpOnly: false,',
        '      sameSite: false,',
        '    },',
        '  },',
        '})',
      ].join('\n'),
    )

    const scanResult = await scan({ directory: testDirectory })
    const cookieDiagnostics = scanResult.diagnostics.filter(
      (diagnostic) => diagnostic.ruleId === 'astro-doctor/no-insecure-session-cookie',
    )

    expect(cookieDiagnostics).toHaveLength(3)
    expect(cookieDiagnostics.map((diagnostic) => diagnostic.line)).toEqual([7, 8, 9])
  })

  test('accepts secure session cookie configuration', async () => {
    writeFileSync(
      join(testDirectory, 'astro.config.ts'),
      [
        "import { defineConfig } from 'astro/config'",
        '',
        'export default defineConfig({',
        '  session: {',
        '    cookie: { secure: true, httpOnly: true, sameSite: "lax" },',
        '  },',
        '})',
      ].join('\n'),
    )

    const scanResult = await scan({ directory: testDirectory })

    expect(
      scanResult.diagnostics.some(
        (diagnostic) => diagnostic.ruleId === 'astro-doctor/no-insecure-session-cookie',
      ),
    ).toBe(false)
  })

  test('reports DOMContentLoaded usage across a ClientRouter project in strict mode', async () => {
    mkdirSync(join(testDirectory, 'src', 'components'), { recursive: true })
    mkdirSync(join(testDirectory, 'src', 'layouts'), { recursive: true })
    writeFileSync(
      join(testDirectory, 'src', 'layouts', 'layout.astro'),
      [
        '---',
        "import { ClientRouter } from 'astro:transitions'",
        '---',
        '<ClientRouter />',
        '<slot />',
      ].join('\n'),
    )
    writeFileSync(
      join(testDirectory, 'src', 'components', 'menu.astro'),
      [
        '<button id="menu">Menu</button>',
        '<script>',
        "  document.addEventListener('DOMContentLoaded', () => {})",
        '</script>',
      ].join('\n'),
    )

    const recommendedResult = await scan({ directory: testDirectory })
    const strictResult = await scan({
      directory: testDirectory,
      rules: getPresetRules('strict'),
    })

    expect(
      recommendedResult.diagnostics.some(
        (diagnostic) =>
          diagnostic.ruleId === 'astro-doctor/require-client-router-script-lifecycle',
      ),
    ).toBe(false)
    expect(strictResult.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'astro-doctor/require-client-router-script-lifecycle',
          filePath: join(testDirectory, 'src', 'components', 'menu.astro'),
          line: 3,
          severity: 'error',
          category: 'best-practices',
        }),
      ]),
    )
  })

  test('accepts astro:page-load initialization in a ClientRouter project', async () => {
    writeFileSync(
      join(testDirectory, 'layout.astro'),
      [
        '---',
        "import { ClientRouter } from 'astro:transitions'",
        '---',
        '<ClientRouter />',
        '<script>',
        "  document.addEventListener('astro:page-load', () => {})",
        '</script>',
      ].join('\n'),
    )

    const scanResult = await scan({
      directory: testDirectory,
      rules: getPresetRules('strict'),
    })

    expect(
      scanResult.diagnostics.some(
        (diagnostic) =>
          diagnostic.ruleId === 'astro-doctor/require-client-router-script-lifecycle',
      ),
    ).toBe(false)
  })
})
