import { defineConfig, Extension, Format, Preset, Runtime, Testing, Tool } from '@santi020k/eslint-config-basic'

import tseslint from 'typescript-eslint'

export default await defineConfig(
  {
    autoFrameworks: false,
    detection: { libraries: false },
    detectRootDir: import.meta.dirname,
    extensions: [Extension.Boundaries, Extension.Unicorn],
    formats: [Format.Jsonc, Format.Markdown],
    ignores: ['**/CHANGELOG.md'],
    preset: Preset.Monorepo,
    projects: {
      'packages/eslint-plugin-astro-doctor': {
        preset: Preset.Library,
      },
      'packages/astro-doctor': {
        preset: Preset.Library,
        runtime: Runtime.Node,
      },
    },
    testing: [Testing.Vitest],
    tools: [Tool.Pnpm, Tool.Cspell, Tool.GithubActions],
    tsconfigRootDir: import.meta.dirname,
    typescript: {
      projectService: {
        allowDefaultProject: ['*.ts', '*.js', '**/*.ts', '**/*.js', '**/*.cjs', '**/*.mjs'],
        defaultProject: 'tsconfig.eslint.json',
      }
    },
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
    files: ['**/*.config.ts', '**/*.config.js'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      }
    },
    ...tseslint.configs.disableTypeChecked,
  }
)
