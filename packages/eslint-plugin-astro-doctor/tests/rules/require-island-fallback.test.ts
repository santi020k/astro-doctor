import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/require-island-fallback.js'

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

ruleTester.run('require-island-fallback', rule, {
  valid: [
    {
      code: `---
import Chart from '../components/Chart.tsx'
---
<Chart client:only="react">
  <div slot="fallback">Loading chart...</div>
</Chart>`,
      filename: 'test.astro',
    },
    {
      code: `---
import Avatar from '../components/Avatar.astro'
---
<Avatar server:defer>
  <span slot="fallback">Loading...</span>
</Avatar>`,
      filename: 'test.astro',
    },
    {
      code: `<Chart client:only="react" />`,
      filename: 'test.tsx',
    },
  ],
  invalid: [
    {
      code: `---
import Chart from '../components/Chart.tsx'
---
<Chart client:only="react" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'clientOnlyFallback' }],
    },
    {
      code: `---
import Avatar from '../components/Avatar.astro'
---
<Avatar server:defer />`,
      filename: 'test.astro',
      errors: [{ messageId: 'serverDeferFallback' }],
    },
  ],
})
