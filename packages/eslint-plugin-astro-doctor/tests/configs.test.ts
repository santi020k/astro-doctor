import { ESLint } from 'eslint'
import { describe, expect, test } from 'vitest'

import astroDoctorPlugin, { getAstroEcosystemRuleCount } from '../src/index.js'

describe('Astro Doctor configs', () => {
  test('recommended composes proprietary and official Astro rules', () => {
    const rules = astroDoctorPlugin.configs.recommended?.rules

    expect(rules?.['astro-doctor/no-client-load-overuse']).toBe('warn')
    expect(rules?.['astro/missing-client-only-directive-value']).toBe('error')
  })

  test('strict adds accessibility rules and disables duplicate diagnostics', () => {
    const rules = astroDoctorPlugin.configs.strict?.rules

    expect(rules?.['astro/jsx-a11y/iframe-has-title']).toBe('error')
    expect(rules?.['astro/no-set-html-directive']).toBe('error')
    expect(rules?.['astro-doctor/no-missing-alt']).toBe('off')
    expect(rules?.['astro-doctor/no-set-html']).toBe('off')
  })

  test('all exposes all non-deprecated official Astro rules', () => {
    const rules = astroDoctorPlugin.configs.all?.rules ?? {}
    const activeAstroRuleIds = Object.entries(rules)
      .filter(([ruleId, severity]) => ruleId.startsWith('astro/') && severity !== 'off')

    expect(getAstroEcosystemRuleCount()).toBe(54)
    expect(activeAstroRuleIds).toHaveLength(54)
    expect(rules['astro/valid-compile']).toBeUndefined()
  })

  test('strict accessibility rules execute without consumer-installed dependencies', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [astroDoctorPlugin.configs.strict],
      ignore: false,
    })
    const results = await eslint.lintText(
      '---\n---\n<iframe src="https://example.com"></iframe>',
      { filePath: 'index.astro' },
    )

    expect(results[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'astro/jsx-a11y/iframe-has-title' }),
      ]),
    )
  })
})
