import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/no-client-load-overuse.js'

// Wire Vitest's globals into ESLint's RuleTester
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

ruleTester.run('no-client-load-overuse', rule, {
  valid: [
    // client:idle is fine — hydrates after initial load
    {
      code: `---\nimport Counter from './Counter.tsx'\n---\n<Counter client:idle />`,
      filename: 'test.astro',
    },
    // client:visible is fine — hydrates on viewport entry
    {
      code: `---\nimport Counter from './Counter.tsx'\n---\n<Counter client:visible />`,
      filename: 'test.astro',
    },
    // client:media is fine — hydrates on media query match
    {
      code: `---\nimport Nav from './Nav.tsx'\n---\n<Nav client:media="(max-width: 640px)" />`,
      filename: 'test.astro',
    },
    // client:only is fine — explicit opt-out of SSR
    {
      code: `---\nimport Chart from './Chart.tsx'\n---\n<Chart client:only="react" />`,
      filename: 'test.astro',
    },
    // No client directive at all — pure SSR component
    {
      code: `---\nimport Header from './Header.astro'\n---\n<Header />`,
      filename: 'test.astro',
    },
    // Plain HTML elements should not trigger the rule
    {
      code: `<div class="wrapper"><p>Hello</p></div>`,
      filename: 'test.astro',
    },
    // Non-astro files are ignored
    {
      code: `const directive = 'client:load'`,
      filename: 'test.ts',
    },
    // Single client:load is within the default max of 1
    {
      code: `---\nimport Counter from './Counter.tsx'\n---\n<Counter client:load />`,
      filename: 'test.astro',
    },
    // Single client:load with additional props — still within max
    {
      code: `---\nimport Counter from './Counter.tsx'\n---\n<Counter value={42} client:load aria-label="counter" />`,
      filename: 'test.astro',
    },
    // max: 2 allows two usages
    {
      code: [
        '---',
        "import A from './A.tsx'",
        "import B from './B.tsx'",
        '---',
        '<A client:load />',
        '<B client:load />',
      ].join('\n'),
      filename: 'test.astro',
      options: [{ max: 2 }],
    },
  ],
  invalid: [
    // Two client:load usages exceed the default max of 1 — one file-level report
    {
      code: [
        '---',
        "import A from './A.tsx'",
        "import B from './B.tsx'",
        '---',
        '<A client:load />',
        '<B client:load />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'tooManyClientLoad' }],
    },
    // Three usages with max: 1 — one file-level report
    {
      code: [
        '---',
        "import A from './A.tsx'",
        "import B from './B.tsx'",
        "import C from './C.tsx'",
        '---',
        '<A client:load />',
        '<B client:load />',
        '<C client:load />',
      ].join('\n'),
      filename: 'test.astro',
      options: [{ max: 1 }],
      errors: [{ messageId: 'tooManyClientLoad' }],
    },
    // max: 0 — any client:load triggers; reports one error per occurrence
    {
      code: `---\nimport Counter from './Counter.tsx'\n---\n<Counter client:load />`,
      filename: 'test.astro',
      options: [{ max: 0 }],
      errors: [{ messageId: 'preferLazyDirective' }],
    },
    // max: 0, multiple usages — one error per occurrence
    {
      code: [
        '---',
        "import A from './A.tsx'",
        "import B from './B.tsx'",
        '---',
        '<A client:load />',
        '<B client:load />',
      ].join('\n'),
      filename: 'test.astro',
      options: [{ max: 0 }],
      errors: [{ messageId: 'preferLazyDirective' }, { messageId: 'preferLazyDirective' }],
    },
  ],
})
