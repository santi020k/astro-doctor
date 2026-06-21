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
        allowDefaultProject: ['**/*.ts', '**/*.js', 'packages/*/vitest.config.ts']
      }
    },
    workspacePrefixes: ['@santi020k'],
  },
  {
    files: ['**/*.md'],
    rules: {
      'markdown/fenced-code-language': 'off',
    }
  },
  {
    rules: {
      'complexity': 'off',
      'preserve-caught-error': 'off',
      '@cspell/spellchecker': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      'n/no-unpublished-import': 'off',
      'vitest/consistent-test-it': 'off',
    }
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
)
