import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe } from 'vitest'

import rule from '../../src/rules/prefer-class-list.js'

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

ruleTester.run('prefer-class-list', rule, {
  valid: [
    // class:list is the preferred pattern
    {
      code: [
        '---',
        'const isActive = true',
        '---',
        '<div class:list={["btn", { active: isActive }]} />',
      ].join('\n'),
      filename: 'test.astro',
    },
    // Static class string is fine
    {
      code: `---\n---\n<div class="container mx-auto" />`,
      filename: 'test.astro',
    },
    // Class expression with a single variable is fine (simple dynamic class)
    {
      code: `---\nconst cls = 'active'\n---\n<div class={cls} />`,
      filename: 'test.astro',
    },
    // Non-astro files are ignored
    {
      code: 'const cls = `btn ${isActive ? "active" : ""}`',
      filename: 'test.ts',
    },
  ],
  invalid: [
    // Template literal with conditional in class — use class:list instead
    {
      code: [
        '---',
        'const isActive = true',
        '---',
        '<div class={`btn ${isActive ? "active" : ""}`} />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'preferClassList' }],
    },
    // String concatenation for class — use class:list instead
    {
      code: [
        '---',
        'const isActive = true',
        '---',
        '<div class={"btn " + (isActive ? "active" : "")} />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'preferClassList' }],
    },
    // Multiple elements with dynamic class strings
    {
      code: [
        '---',
        'const isOpen = false',
        'const isActive = true',
        '---',
        '<nav class={`nav ${isOpen ? "open" : ""}`} />',
        '<button class={`btn ${isActive ? "active" : ""}`} />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'preferClassList' }, { messageId: 'preferClassList' }],
    },
  ],
})
