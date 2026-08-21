import { defineConfig, Extension } from '@santi020k/eslint-config-basic'

export default defineConfig(
  {
    extensions: [Extension.Boundaries, Extension.Unicorn],
    ignores: ['**/CHANGELOG.md'],
    workspacePrefixes: ['@santi020k'],
  },


  // The CLI, install helper, and LSP stub intentionally write to stdout/stderr.
  {
    files: [
      'packages/astro-doctor/src/cli.ts',
      'packages/astro-doctor/src/init.ts',
      'packages/astro-doctor/src/install.ts',
      'packages/astro-doctor/src/lsp.ts',
      'packages/astro-doctor/src/multi-project.ts',
      'packages/astro-doctor/src/report/console.ts',
      'packages/astro-doctor/src/rules-explain.ts',
      'packages/astro-doctor/src/why.ts',
      'packages/astro-doctor/bin/**/*.ts',
    ],
    name: 'local-cli-console',
    rules: {
      'no-console': 'off',
      'unicorn/no-process-exit': 'off',
      'n/no-unpublished-import': 'off',
      'n/hashbang': 'off',
    },
  },
  {
    files: ['packages/vscode-astro-doctor/**/*.{cjs,ts}'],
    name: 'vscode-extension-established-style',
    rules: {
      '@stylistic/arrow-parens': 'off',
      '@stylistic/comma-dangle': ['warn', 'always-multiline'],
      '@stylistic/function-call-argument-newline': 'off',
      '@stylistic/implicit-arrow-linebreak': 'off',
      '@stylistic/max-len': 'off',
      '@stylistic/member-delimiter-style': 'off',
      '@stylistic/operator-linebreak': 'off',
    },
  }
)
