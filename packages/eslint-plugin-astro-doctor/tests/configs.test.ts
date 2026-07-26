import { ESLint } from 'eslint'
import astroPlugin from 'eslint-plugin-astro'
import { describe, expect, test } from 'vitest'

import astroDoctorPlugin, {
  ASTRO_ESLINT_PLUGINS,
  disableDuplicateAstroDoctorRules,
  getAstroEcosystemRuleCount,
  getAstroEcosystemRuleDocs,
  getAstroEcosystemRules,
  getAstroRuleCategory,
  getAstroRuleDescription,
  getAstroRuleDocUrl,
} from '../src/index.js'

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
    const nonDeprecatedAstroRuleCount = Object.entries(astroPlugin.rules)
      .filter(([ruleName, rule]) => ruleName !== 'valid-compile' && !rule.meta?.deprecated)
      .length

    expect(getAstroEcosystemRuleCount()).toBe(nonDeprecatedAstroRuleCount)
    expect(activeAstroRuleIds).toHaveLength(nonDeprecatedAstroRuleCount)
    expect(rules['astro/no-omitted-end-tags']).toBeUndefined()
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

  test('exposes normalized upstream rule metadata', () => {
    const recommendedRules = getAstroEcosystemRules('ci')
    const deduplicatedRules = disableDuplicateAstroDoctorRules({
      'astro-doctor/no-missing-alt': 'error',
      'astro/jsx-a11y/alt-text': 'off',
    })
    const docs = getAstroEcosystemRuleDocs()

    expect(recommendedRules['astro/missing-client-only-directive-value']).toBe('error')
    expect(deduplicatedRules['astro-doctor/no-missing-alt']).toBe('error')
    expect(ASTRO_ESLINT_PLUGINS.astro?.rules?.['jsx-a11y/iframe-has-title']).toBeDefined()
    expect(getAstroRuleCategory('not-astro/example')).toBeUndefined()
    expect(getAstroRuleCategory('astro/jsx-a11y/alt-text')).toBe('accessibility')
    expect(getAstroRuleCategory('astro/no-set-html-directive')).toBe('security')
    expect(getAstroRuleCategory('astro/no-conflict-set-directives')).toBe('best-practices')
    expect(getAstroRuleDocUrl('not-astro/example')).toBeUndefined()
    expect(getAstroRuleDocUrl('astro/no-conflict-set-directives')).toContain('eslint-plugin-astro')
    expect(getAstroRuleDescription('not-astro/example')).toBeUndefined()
    expect(getAstroRuleDescription('astro/no-conflict-set-directives')).toBeTypeOf('string')
    expect(docs['astro/no-conflict-set-directives']).toContain('best practices')
    expect(docs['astro/valid-compile']).toBeUndefined()
  })
})
