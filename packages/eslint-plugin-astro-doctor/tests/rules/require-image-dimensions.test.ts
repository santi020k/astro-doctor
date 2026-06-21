import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/require-image-dimensions.js'

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

ruleTester.run('require-image-dimensions', rule, {
  valid: [
    {
      code: [
        '---',
        "import { Image } from 'astro:assets'",
        "import hero from '../assets/hero.png'",
        '---',
        '<Image src={hero} alt="Hero" />',
      ].join('\n'),
      filename: 'test.astro',
    },
    {
      code: `---
import { Image } from 'astro:assets'
---
<Image src="/hero.png" alt="Hero" width="800" height="400" />`,
      filename: 'test.astro',
    },
    {
      code: `---
import { Image } from 'astro:assets'
---
<Image src="https://cdn.example.com/hero.png" alt="Hero" inferSize />`,
      filename: 'test.astro',
    },
    {
      code: `<Image src="/hero.png" alt="Hero" />`,
      filename: 'test.tsx',
    },
  ],
  invalid: [
    {
      code: `---
import { Image } from 'astro:assets'
---
<Image src="/hero.png" alt="Hero" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'publicImageDimensions' }],
    },
    {
      code: `---
import { Picture } from 'astro:assets'
---
<Picture src="https://cdn.example.com/hero.png" alt="Hero" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'remoteImageDimensions' }],
    },
  ],
})
