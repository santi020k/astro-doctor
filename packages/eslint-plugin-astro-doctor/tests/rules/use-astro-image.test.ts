import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe } from 'vitest'

import rule from '../../src/rules/use-astro-image.js'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser: astroParser,
    parserOptions: {
      sourceType: 'module',
    },
  },
})

ruleTester.run('use-astro-image', rule, {
  valid: [
    // Using <Image> from astro:assets — correct
    {
      code: [
        '---',
        "import { Image } from 'astro:assets'",
        "import myImage from '../assets/hero.png'",
        '---',
        '<Image src={myImage} alt="hero" />',
      ].join('\n'),
      filename: 'test.astro',
    },
    // Using <Picture> from astro:assets — also correct
    {
      code: [
        '---',
        "import { Picture } from 'astro:assets'",
        "import myImage from '../assets/hero.png'",
        '---',
        '<Picture src={myImage} alt="hero" formats={["avif", "webp"]} />',
      ].join('\n'),
      filename: 'test.astro',
    },
    // Remote img in a markdown-output context with explicit opt-out comment is fine
    // (this tests that valid code with no img passes silently)
    {
      code: `---\nconst title = 'Hello'\n---\n<h1>{title}</h1>`,
      filename: 'test.astro',
    },
    // Non-astro files are ignored
    {
      code: `<img src="/logo.png" alt="logo" />`,
      filename: 'test.tsx',
    },
  ],
  invalid: [
    // Raw <img> tag should trigger the error
    {
      code: `---\n---\n<img src="/hero.png" alt="hero" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'useAstroImage' }],
    },
    // <img> without alt also triggers (use-astro-image takes priority here)
    {
      code: `---\n---\n<img src="/logo.png" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'useAstroImage' }],
    },
    // Multiple raw img tags — one error per tag
    {
      code: [
        '---',
        '---',
        '<img src="/hero.png" alt="hero" />',
        '<img src="/logo.png" alt="logo" />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'useAstroImage' }, { messageId: 'useAstroImage' }],
    },
    // <img> inside a component template
    {
      code: [
        '---',
        "import Card from './Card.astro'",
        '---',
        '<Card>',
        '  <img src="/thumb.jpg" alt="thumbnail" />',
        '</Card>',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'useAstroImage' }],
    },
  ],
})
