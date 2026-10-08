import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

import { Linter } from 'eslint'

const formatsRequire = createRequire(import.meta.resolve('@santi020k/eslint-config-formats'))
const markdownRequire = createRequire(formatsRequire.resolve('@eslint/markdown'))
const mathRequire = createRequire(markdownRequire.resolve('micromark-extension-math'))
const { renderToString } = mathRequire('katex')
const markdown = markdownRequire('@eslint/markdown').default
const unsafeExpression = String.raw`\href{javascript:alert(1)}{unsafe}`

test('KaTeX ignores inherited trust options', () => {
  const inheritedOptions = Object.create({ trust: true })

  assert.doesNotMatch(renderToString(unsafeExpression, inheritedOptions), /href="javascript:/u)

  assert.match(renderToString(unsafeExpression, { trust: true }), /href="javascript:/u)
})

test('KaTeX preserves ordinary mathematical rendering', () => {
  assert.match(renderToString(String.raw`\frac{a}{b}`, { displayMode: true }), /<math\s/u)

  assert.match(renderToString('a+b'), /<math\s/u)
})

test('Markdown linting continues to parse inline, display, and incomplete math', () => {
  const linter = new Linter()

  const fixtures = [
    '# Math\n\n$a+b$\n',
    '# Math\n\n$$\na+b\n$$\n',
    '# Math\n\n$\\unknown{x}\n',
  ]

  const configuration = {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    languageOptions: { math: true },
  }

  for (const fixture of fixtures) {
    assert.deepEqual(linter.verify(fixture, configuration, 'dependency-smoke.md'), [])
  }
})
