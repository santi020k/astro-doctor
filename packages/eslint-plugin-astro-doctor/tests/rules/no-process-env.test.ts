import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/no-process-env.js'

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

ruleTester.run('no-process-env', rule, {
  valid: [
    // import.meta.env is the correct Astro idiom
    {
      code: `---\nconst apiKey = import.meta.env.API_KEY\n---\n<p>{apiKey}</p>`,
      filename: 'test.astro',
    },
    // import.meta.env.PUBLIC_ for client-visible vars
    {
      code: `---\nconst title = import.meta.env.PUBLIC_SITE_TITLE\n---\n<h1>{title}</h1>`,
      filename: 'test.astro',
    },
    // process.env in non-Astro files is allowed
    {
      code: `const key = process.env.API_KEY`,
      filename: 'test.ts',
    },
    // process used for something other than env
    {
      code: `---\nconst pid = process.pid\n---\n<p>{pid}</p>`,
      filename: 'test.astro',
    },
  ],
  invalid: [
    // process.env.VARIABLE in frontmatter
    {
      code: `---\nconst apiKey = process.env.API_KEY\n---\n<p>{apiKey}</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'useImportMetaEnv' }],
    },
    // Bare process.env access
    {
      code: `---\nconst env = process.env\n---\n<p>test</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'useImportMetaEnv' }],
    },
    // process.env in a template expression
    {
      code: `---\n---\n<p>{process.env.SITE_NAME}</p>`,
      filename: 'test.astro',
      errors: [{ messageId: 'useImportMetaEnv' }],
    },
    // Multiple process.env usages — one error each
    {
      code: [
        '---',
        'const key = process.env.API_KEY',
        'const secret = process.env.SECRET',
        '---',
        '<p>test</p>',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'useImportMetaEnv' }, { messageId: 'useImportMetaEnv' }],
    },
  ],
})
