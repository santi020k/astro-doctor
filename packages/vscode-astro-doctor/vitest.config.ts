import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      vscode: new URL('./tests/__mocks__/vscode.ts', import.meta.url).pathname,
      'vscode-languageclient/node': new URL(
        './tests/__mocks__/vscode-languageclient-node.ts',
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    tsconfig: './tsconfig.test.json',
  },
})
