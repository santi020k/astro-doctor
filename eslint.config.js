import { defineConfig, Extension, Format, Preset, Runtime, Testing, Tool } from '@santi020k/eslint-config-basic'

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
    tools: [Tool.Pnpm, Tool.CSpell, Tool.GithubActions],
    tsconfigRootDir: import.meta.dirname,
    typescript: {
      projectService: {
        allowDefaultProject: ['*.ts', '*.js', '**/*.ts', '**/*.js', '**/*.cjs', '**/*.mjs'],
        defaultProject: 'tsconfig.eslint.json',
      }
    },
    workspacePrefixes: ['@santi020k'],
  },

  // The ESLint plugin source works with unknown AST node shapes from astro-eslint-parser.
  // Casting to `any` is unavoidable there — relax the rule for those files only.
  {
    files: ['packages/eslint-plugin-astro-doctor/src/rules/**/*.ts'],
    name: 'local-plugin-rules-any',
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  // The CLI, install helper, and LSP stub intentionally write to stdout/stderr.
  {
    files: [
      'packages/astro-doctor/src/cli.ts',
      'packages/astro-doctor/src/install.ts',
      'packages/astro-doctor/src/lsp.ts',
      'packages/astro-doctor/src/report/console.ts',
      'packages/astro-doctor/bin/**/*.ts',
    ],
    name: 'local-cli-console',
    rules: {
      'no-console': 'off',
      'unicorn/no-process-exit': 'off',
      'n/no-unpublished-import': 'off',
    },
  },
  {
    files: ['**/*.config.ts', '**/*.config.js'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      }
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/unbound-method': 'off',
    }
  }
)
