import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/no-public-secret-env.js'

RuleTester.describe = describe
RuleTester.it = test

const ruleTester = new RuleTester({
  languageOptions: {
    parser: astroParser,
    parserOptions: {
      sourceType: 'module',
    },
  },
})

ruleTester.run('no-public-secret-env', rule, {
  valid: [
    {
      code: `---
const apiUrl = import.meta.env.PUBLIC_API_URL
const secret = import.meta.env.API_SECRET
---
<p>{apiUrl}</p>`,
      filename: 'test.astro',
    },
    {
      code: `const apiKey = import.meta.env.PUBLIC_API_KEY`,
      filename: 'test.ts',
    },
  ],
  invalid: [
    {
      code: `---
const token = import.meta.env.PUBLIC_TOKEN
---
<p>{token}</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'publicSecretEnv', data: { variableName: 'PUBLIC_TOKEN' } }],
    },
    {
      code: `---
const key = import.meta.env.PUBLIC_API_KEY
---
<p>{key}</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'publicSecretEnv', data: { variableName: 'PUBLIC_API_KEY' } }],
    },
  ],
})
