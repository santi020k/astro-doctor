import { defineConfig, Extension, Tool } from '@santi020k/eslint-config-basic'

export default await defineConfig(
  {
    extensions: [Extension.Unicorn],
    tailwind: {
      noUnknownClasses: false
    },
    tools: [Tool.Cspell]
  }, {
    files: ['**/*.astro'],
    rules: {
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@stylistic/indent': 'off',
      '@stylistic/jsx-closing-tag-location': 'off',
      '@stylistic/max-len': 'off',
      'better-tailwindcss/enforce-consistent-class-order': 'off',
      'better-tailwindcss/no-unknown-classes': 'off'
    }
  }, {
    files: ['src/pages/index.astro'],
    rules: {
      // HACK: Astro exposes inline JSX fragments to type-aware rules as parser-generated `any`.
      '@typescript-eslint/no-unsafe-assignment': 'off'
    }
  }, {
    files: ['src/env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off'
    }
  }
)
