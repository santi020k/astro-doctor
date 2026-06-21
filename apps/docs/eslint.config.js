import { defineConfig, Extension, Format, Preset, Tool } from '@santi020k/eslint-config-basic'

export default await defineConfig(
  {
    detectRootDir: import.meta.dirname,
    extensions: [Extension.Unicorn],
    formats: [Format.Markdown],
    frameworks: { astro: true },
    preset: Preset.Browser,
    tools: [Tool.CSpell],
    tsconfigRootDir: import.meta.dirname,
    typescript: true
  }, {
    files: ['**/*.astro'],
    rules: {
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@stylistic/indent': 'off',
      '@stylistic/jsx-closing-tag-location': 'off',
      '@stylistic/max-len': 'off'
    }
  }, {
    files: ['src/env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off'
    }
  }
)
