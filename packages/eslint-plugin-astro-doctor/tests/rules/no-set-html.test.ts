import { RuleTester } from 'eslint'
import * as astroParser from 'astro-eslint-parser'
import { describe, it } from 'vitest'
import rule from '../../src/rules/no-set-html.js'

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

ruleTester.run('no-set-html', rule, {
  valid: [
    // No set:html — safe
    {
      code: `---\nconst message = '<b>Hello</b>'\n---\n<p>{message}</p>`,
      filename: 'test.astro',
    },
    // set:text is safe
    {
      code: `---\nconst text = 'Hello World'\n---\n<p set:text={text} />`,
      filename: 'test.astro',
    },
    // Static string content is safe
    {
      code: `---\n---\n<p>Static content</p>`,
      filename: 'test.astro',
    },
    // Non-astro files are ignored
    {
      code: `element.innerHTML = userInput`,
      filename: 'test.ts',
    },
  ],
  invalid: [
    // set:html with a dynamic expression — XSS risk
    {
      code: `---\nconst html = await fetchContent()\n---\n<div set:html={html} />`,
      filename: 'test.astro',
      errors: [{ messageId: 'dangerousHtml' }],
    },
    // set:html with a static string literal is still flagged (educate the user)
    {
      code: `---\n---\n<p set:html="<b>Bold</b>" />`,
      filename: 'test.astro',
      errors: [{ messageId: 'dangerousHtml' }],
    },
    // set:html on any element
    {
      code: `---\nconst body = '<p>content</p>'\n---\n<article set:html={body} />`,
      filename: 'test.astro',
      errors: [{ messageId: 'dangerousHtml' }],
    },
    // Multiple set:html usages
    {
      code: [
        '---',
        "const a = '<b>A</b>'",
        "const b = '<i>B</i>'",
        '---',
        '<div set:html={a} />',
        '<span set:html={b} />',
      ].join('\n'),
      filename: 'test.astro',
      errors: [{ messageId: 'dangerousHtml' }, { messageId: 'dangerousHtml' }],
    },
  ],
})
