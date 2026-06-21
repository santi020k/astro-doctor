import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/no-unprocessed-script-surprises.js'

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

ruleTester.run('no-unprocessed-script-surprises', rule, {
  valid: [
    {
      code: `---
---
<script>console.log('bundled')</script>`,
      filename: 'test.astro',
    },
    {
      code: `---
---
<script src="../scripts/local.ts"></script>`,
      filename: 'test.astro',
    },
    {
      code: `<script is:inline>console.log('ignored')</script>`,
      filename: 'test.html',
    },
  ],
  invalid: [
    {
      code: `---
---
<script is:inline>console.log('raw')</script>`,
      filename: 'test.astro',
      errors: [{ messageId: 'inlineScriptOptOut' }],
    },
    {
      code: `---
---
<script type="module">console.log('raw')</script>`,
      filename: 'test.astro',
      errors: [{ messageId: 'unprocessedScript' }],
    },
    {
      code: `---
---
<script src="../scripts/local.ts" defer></script>`,
      filename: 'test.astro',
      errors: [{ messageId: 'unprocessedScript' }],
    },
  ],
})
