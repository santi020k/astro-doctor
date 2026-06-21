import { defineConfig } from '@santi020k/eslint-config-basic'

export default await defineConfig({
  typescript: 'strict',
  testing: ['vitest']
})
