import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/no-blocking-script.js'

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

ruleTester.run('no-blocking-script', rule, {
  valid: [
    // Inline script body — no src, doesn't block parser
    {
      code: `---\n---\n<script>console.log('hello')</script>`,
      filename: 'test.astro',
    },
    // External script with defer
    {
      code: `---\n---\n<script src="/analytics.js" defer></script>`,
      filename: 'test.astro',
    },
    // External script with async
    {
      code: `---\n---\n<script src="/widget.js" async></script>`,
      filename: 'test.astro',
    },
    // External script with type="module" (always deferred by the browser)
    {
      code: `---\n---\n<script src="/app.js" type="module"></script>`,
      filename: 'test.astro',
    },
    // Astro-processed script (no is:inline, no src) — bundled and deferred
    {
      code: `---\nimport { something } from './lib'\n---\n<script>something()</script>`,
      filename: 'test.astro',
    },
    // Non-astro files are ignored
    {
      code: `<script src="/app.js"></script>`,
      filename: 'test.html',
    },
  ],
  invalid: [
    // External script without any loading strategy — render-blocking
    {
      code: `---\n---\n<script src="https://cdn.example.com/widget.js"></script>`,
      filename: 'test.astro',
      errors: [{ messageId: 'blockingScript' }],
    },
    // is:inline + src without defer/async
    {
      code: `---\n---\n<script is:inline src="/legacy.js"></script>`,
      filename: 'test.astro',
      errors: [{ messageId: 'blockingScript' }],
    },
    // Multiple blocking scripts — one error each
    {
      code: [
        '---',
        '---',
        '<script src="/analytics.js"></script>',
        '<script src="/widget.js"></script>',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'blockingScript' }, { messageId: 'blockingScript' }],
    },
  ],
})
