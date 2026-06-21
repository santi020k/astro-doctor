import { defineConfig, Extension, Preset, Testing, Tool } from '@santi020k/eslint-config-basic'

export default await defineConfig({
  autoFrameworks: false,
  detection: { libraries: false },
  detectRootDir: import.meta.dirname,
  extensions: [Extension.Boundaries],
  ignores: [
    '**/CHANGELOG.md',
  ],
  preset: Preset.Monorepo,
  testing: [Testing.Vitest],
  tools: [Tool.Pnpm],
  tsconfigRootDir: import.meta.dirname,
  typescript: true,
  workspacePrefixes: ['@santi020k'],
})
