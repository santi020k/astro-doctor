import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/prefer-content-collections.js'

RuleTester.describe = describe
RuleTester.it = test

const tester = new RuleTester({
  languageOptions: {
    parser: astroParser,
    parserOptions: { sourceType: 'module' },
  },
})

tester.run('astro-doctor/prefer-content-collections', rule, {
  valid: [
    {
      code: `---
import { getCollection } from 'astro:content'
const posts = await getCollection('blog')
---
<ul>{posts.map(p => <li>{p.data.title}</li>)}</ul>`,
      filename: 'test.astro',
    },
    {
      code: `---
const assets = import.meta.glob('../assets/**/*.png')
---
<div></div>`,
      filename: 'test.astro',
    },
    {
      code: `<div></div>`,
      filename: 'test.astro',
    },
    {
      code: `---
const posts = await Astro.glob('../content/**/*.md')
---
<div></div>`,
      filename: 'test.js',
    },
  ],
  invalid: [
    {
      code: `---
const posts = await Astro.glob('../content/**/*.md')
---
<ul>{posts.map(p => <li>{p.frontmatter.title}</li>)}</ul>`,
      filename: 'test.astro',
      errors: [{ messageId: 'preferContentCollections' }],
    },
    {
      code: `---
const all = await Astro.glob('./**/*.mdx')
---
<div></div>`,
      filename: 'test.astro',
      errors: [{ messageId: 'preferContentCollections' }],
    },
    {
      code: `---
const posts = import.meta.glob('../content/**/*.md')
---
<div></div>`,
      filename: 'test.astro',
      errors: [{ messageId: 'preferContentCollections' }],
    },
    {
      code: `---
const docs = import.meta.glob('./**/*.{md,mdx}')
---
<div></div>`,
      filename: 'test.astro',
      errors: [{ messageId: 'preferContentCollections' }],
    },
    {
      code: `---
const posts = Astro.glob('../content/**/*.md')
---
<div></div>`,
      filename: 'test.astro',
      errors: [{ messageId: 'preferContentCollections' }],
    },
  ],
})
