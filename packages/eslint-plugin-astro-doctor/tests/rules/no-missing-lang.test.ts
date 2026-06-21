import * as astroParser from 'astro-eslint-parser'
import { RuleTester } from 'eslint'
import { describe, test } from 'vitest'

import rule from '../../src/rules/no-missing-lang.js'

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

ruleTester.run('no-missing-lang', rule, {
  valid: [
    // <html> with lang attribute
    {
      code: `---\n---\n<html lang="en"><head></head><body></body></html>`,
      filename: 'test.astro',
    },
    // <html> with non-English lang
    {
      code: `---\n---\n<html lang="es"><head></head><body></body></html>`,
      filename: 'test.astro',
    },
    // <html> with a dynamic lang expression
    {
      code: `---\nconst lang = 'fr'\n---\n<html lang={lang}><head></head><body></body></html>`,
      filename: 'test.astro',
    },
    // Component without an <html> element — layout fragments are fine
    {
      code: `---\n---\n<div><slot /></div>`,
      filename: 'test.astro',
    },
    // Non-astro files are ignored
    {
      code: `<html><head></head><body></body></html>`,
      filename: 'test.html',
    },
  ],
  invalid: [
    // <html> without lang
    {
      code: `---\n---\n<html><head></head><body></body></html>`,
      filename: 'test.astro',
      errors: [{ messageId: 'missingLang' }],
    },
    // <html> with other attributes but no lang
    {
      code: `---\n---\n<html class="dark" dir="ltr"><head></head><body></body></html>`,
      filename: 'test.astro',
      errors: [{ messageId: 'missingLang' }],
    },
  ],
})
