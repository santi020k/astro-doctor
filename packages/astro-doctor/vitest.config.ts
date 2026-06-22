import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        'src/cli.ts',
        'src/install.ts',
        'src/lsp.ts',
        'src/why.ts',
        'src/rules-explain.ts',
        'src/report/github.ts',
        'src/report/json.ts',
        'src/report/index.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 70,
        lines: 70,
      },
    },
  },
})
