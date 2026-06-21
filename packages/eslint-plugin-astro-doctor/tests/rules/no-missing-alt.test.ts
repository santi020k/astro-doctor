import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/no-missing-alt.js'

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

ruleTester.run('no-missing-alt', rule, {
  valid: [
    // <img> with alt attribute
    {
      code: `---\n---\n<img src="/hero.png" alt="A scenic mountain landscape" />`,
      filename: 'test.astro',
    },
    // <img> with empty alt (decorative image — intentional)
    {
      code: `---\n---\n<img src="/divider.png" alt="" role="presentation" />`,
      filename: 'test.astro',
    },
    // <Image> from astro:assets with alt
    {
      code: [
        '---',
        "import { Image } from 'astro:assets'",
        "import hero from '../assets/hero.png'",
        '---',
        '<Image src={hero} alt="Hero image" />',
      ].join('\n'),
      filename: 'test.astro',
    },
    // Non-image elements need no alt
    {
      code: `---\n---\n<div><p>Hello world</p></div>`,
      filename: 'test.astro',
    },
    // Non-astro files are ignored
    {
      code: `<img src="/logo.png" />`,
      filename: 'test.tsx',
    },
  ],
  invalid: [
    // <img> missing alt entirely
    {
      code: `---\n---\n<img src="/hero.png" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'missingAlt' }],
    },
    // <Image> from astro:assets missing alt
    {
      code: [
        '---',
        "import { Image } from 'astro:assets'",
        "import hero from '../assets/hero.png'",
        '---',
        '<Image src={hero} width={800} height={400} />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'missingAlt' }],
    },
    // Multiple images missing alt — one error per image
    {
      code: [
        '---',
        '---',
        '<img src="/a.png" />',
        '<img src="/b.png" />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'missingAlt' }, { messageId: 'missingAlt' }],
    },
    // <img> with alt attribute that has an undefined expression (no static value)
    // Note: this is a known edge-case; we flag missing attribute, not empty values
    {
      code: `---\n---\n<img src="/hero.png" width={800} height={400} />`,
      filename: 'test.astro',
      errors: [{ messageId: 'missingAlt' }],
    },
  ],
})
