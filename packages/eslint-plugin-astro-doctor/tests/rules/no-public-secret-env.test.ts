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
      sourceType: 'module'
    }
  }
})

ruleTester.run('no-public-secret-env', rule, {
  valid: [
    {
      code: '---\nconst layout = import.meta.env.PUBLIC_KEYBOARD_LAYOUT\n---\n<p>{layout}</p>',
      filename: 'test.astro'
    },
    {
      code: '---\nconst { PUBLIC_API_URL: apiUrl } = import.meta.env\n---\n<p>{apiUrl}</p>',
      filename: 'test.astro'
    },
    {
      code: '---\nconst other = { PUBLIC_TOKEN: "public" }\nconst { PUBLIC_TOKEN } = other\n---\n<p>{PUBLIC_TOKEN}</p>',
      filename: 'test.astro'
    },
    {
      code: `---
const apiUrl = import.meta.env.PUBLIC_API_URL
const secret = import.meta.env.API_SECRET
---
<p>{apiUrl}</p>`,
      filename: 'test.astro'
    },
    {
      code: 'const apiKey = import.meta.env.PUBLIC_API_KEY',
      filename: 'test.ts'
    }
  ],
  invalid: [
    ...[
      'const token = import.meta.env["PUBLIC_TOKEN"]',
      'const token = import.meta["env"].PUBLIC_TOKEN',
      'const { PUBLIC_TOKEN: token } = import.meta.env',
      'const { ["PUBLIC_TOKEN"]: token } = import.meta.env',
      'const { PUBLIC_TOKEN: token = "" } = import.meta.env'
    ].map(declaration => ({
      code: `---\n${declaration}\n---\n<p>{token}</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'publicSecretEnv', data: { variableName: 'PUBLIC_TOKEN' } }]
    })),
    {
      code: '---\nconst { PUBLIC_TOKEN, PUBLIC_PASSWORD } = import.meta.env\n---\n<p>{PUBLIC_TOKEN}</p>',
      filename: 'test.astro',
      errors: [
        { messageId: 'publicSecretEnv', data: { variableName: 'PUBLIC_TOKEN' } },
        { messageId: 'publicSecretEnv', data: { variableName: 'PUBLIC_PASSWORD' } }
      ]
    },
    {
      code: `---
const token = import.meta.env.PUBLIC_TOKEN
---
<p>{token}</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'publicSecretEnv', data: { variableName: 'PUBLIC_TOKEN' } }]
    },
    {
      code: `---
const key = import.meta.env.PUBLIC_API_KEY
---
<p>{key}</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'publicSecretEnv', data: { variableName: 'PUBLIC_API_KEY' } }]
    }
  ]
})
