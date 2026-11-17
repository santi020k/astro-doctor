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

test('patched glob preserves discovery, ignores and aborts', async context => {
  const { mkdir, mkdtemp, rm, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const cliRequire = createRequire(new URL('../packages/astro-doctor/package.json', import.meta.url))
  const { glob } = cliRequire('glob')
  const directory = await mkdtemp(join(tmpdir(), 'doctor-glob-security-'))

  context.after(() => rm(directory, { recursive: true, force: true }))

  for (const name of ['src/pages', 'node_modules/fixture']) await mkdir(join(directory, name), { recursive: true })

  await writeFile(join(directory, 'src/pages/index.astro'), '<h1>Fixture</h1>')

  await writeFile(join(directory, 'node_modules/fixture/hidden.astro'), '<h1>Hidden</h1>')

  assert.deepEqual(await glob('**/*.astro', { cwd: directory, ignore: ['node_modules/**'] }), ['src/pages/index.astro'])

  const controller = new AbortController()

  controller.abort(new Error('Fixture cancelled'))

  await assert.rejects(glob('**/*', { cwd: directory, signal: controller.signal }), /Fixture cancelled/u)
})

test('shared import boundary rules preserve patched matcher behavior', async () => {
  const { ESLint } = await import('eslint')
  const { default: configuration } = await import('../eslint.config.js')
  const entry = (await configuration).find(config => config.plugins?.import)

  assert.ok(entry)

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [{
      plugins: { 'import-x': entry.plugins.import },
      rules: { 'import-x/no-internal-modules': ['error', { forbid: ['**/internal/**'] }] },
    }],
  })

  const denied = await eslint.lintText('import value from "./internal/secret.js"', { filePath: 'fixture.js' })
  const allowed = await eslint.lintText('import value from "./public.js"', { filePath: 'fixture.js' })

  assert.equal(denied[0].messages.length, 1)

  assert.equal(denied[0].messages[0].ruleId, 'import-x/no-internal-modules')

  assert.equal(allowed[0].messages.length, 0)
})
