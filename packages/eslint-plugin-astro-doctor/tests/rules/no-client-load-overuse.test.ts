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
  ],
  invalid: [
    // client:load on a component triggers the warning
    {
      code: `---\nimport Counter from './Counter.tsx'\n---\n<Counter client:load />`,
      filename: 'test.astro',
      errors: [{ messageId: 'preferLazyDirective' }],
    },
    // client:load with additional props still triggers
    {
      code: `---\nimport Counter from './Counter.tsx'\n---\n<Counter value={42} client:load aria-label="counter" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'preferLazyDirective' }],
    },
    // Multiple components with client:load — one error per usage
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
      errors: [{ messageId: 'preferLazyDirective' }, { messageId: 'preferLazyDirective' }],
    },
  ],
})
