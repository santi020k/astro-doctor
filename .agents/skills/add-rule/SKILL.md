# Add a New Rule to Astro Doctor

Follow this workflow exactly when adding a new lint rule to `@santi020k/eslint-plugin-astro-doctor`.

## Step 1 — Write the test first (TDD)

Create `packages/eslint-plugin-astro-doctor/tests/rules/<rule-name>.test.ts`:

```ts
import { RuleTester } from 'eslint'
import * as astroParser from 'astro-eslint-parser'
import { describe, it } from 'vitest'
import rule from '../../src/rules/<rule-name>.js'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({
  languageOptions: {
    parser: astroParser,
    parserOptions: { sourceType: 'module' },
  },
})

tester.run('astro-doctor/<rule-name>', rule, {
  valid: [
    // ✅ Cases that should NOT trigger the rule
    { code: `<div></div>`, filename: 'test.astro' },
  ],
  invalid: [
    // ❌ Cases that SHOULD trigger the rule
    {
      code: `<bad-element />`,
      filename: 'test.astro',
      errors: [{ messageId: 'yourMessageId' }],
    },
  ],
})
```

Run `pnpm --filter @santi020k/eslint-plugin-astro-doctor run test` — it should FAIL (RED).

## Step 2 — Implement the rule

Create `packages/eslint-plugin-astro-doctor/src/rules/<rule-name>.ts`:

```ts
import { createRule, isAstroFile } from '../utils/rule.js'

export default createRule({
  name: '<rule-name>',
  meta: {
    type: 'suggestion',          // 'problem' | 'suggestion' | 'layout'
    docs: {
      description: 'One-line description of the rule.',
      category: 'best-practices', // 'performance' | 'accessibility' | 'security' | 'best-practices'
      recommended: true,
    },
    messages: {
      yourMessageId: 'Message shown in the lint warning.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (!isAstroFile(context)) return {}

    return {
      // AST selector for the problematic pattern
      'VElement[rawName="element-name"]'(node) {
        context.report({
          node,
          messageId: 'yourMessageId',
        })
      },
    }
  },
})
```

### Key AST selectors for Astro templates

| What you want to target | Selector |
|------------------------|---------|
| Any HTML element `<foo>` | `VElement[rawName="foo"]` |
| Astro client directive | `VAttribute[key.name="client:load"]` |
| Astro set:html | `VAttribute[key.name="set:html"]` |
| Any VAttribute | `VAttribute` |
| class attribute | `VAttribute[key.name="class"]` |

Use `VStartTag` to iterate `node.attributes` and inspect them manually for complex checks.

## Step 3 — Register the rule

Open `packages/eslint-plugin-astro-doctor/src/rules/index.ts` and add:

```ts
import ruleNameRule from './<rule-name>.js'

export const rules = {
  // ... existing rules
  '<rule-name>': ruleNameRule,
}

export const RECOMMENDED_RULES: Record<string, 'error' | 'warn' | 'off'> = {
  // ... existing rules
  'astro-doctor/<rule-name>': 'warn',  // or 'error' for accessibility/security
}
```

## Step 4 — Run tests (should be GREEN now)

```bash
pnpm --filter @santi020k/eslint-plugin-astro-doctor run test
```

## Step 5 — Document the rule

1. **Docs site** — Add an entry to `apps/docs/src/data/rules.ts` with all fields: `id`, `name`, `slug`, `category`, `severity`, `description`, `why`, `bad`, `good`. The `[slug].astro` page generates automatically.
2. **Docs rules index** — Add the rule name to the appropriate category section in `apps/docs/src/pages/docs/rules/index.astro`. Also add it to `apps/docs/src/data/nav.ts` under the Rules section.
3. **Landing page** — Update the rule count in `apps/docs/src/pages/index.astro` (search for "Nine rules" or the current count).
4. **Agent skills** — Add the rule with before/after examples to `skills/SKILL.md` and `.agents/skills/astro-rules/SKILL.md`.
5. **READMEs** — Add it to the rules table in the root `README.md` and in `packages/eslint-plugin-astro-doctor/README.md`.
6. **Schema** — Add the rule name to `apps/docs/public/schema/config.json` under `properties.rules.properties`.
7. **llms.txt** — Update the rule list and any new AST selector patterns used.

## Step 6 — Changeset

```bash
pnpm changeset
```

Select `minor` for a new rule (new public surface). Write: `feat(eslint-plugin): add <rule-name> rule`.

## Rule categories and default severities

| Category | Default severity | Examples |
|----------|-----------------|---------|
| `performance` | `warn` | `no-client-load-overuse`, `use-astro-image`, `no-blocking-script` |
| `accessibility` | `error` | `no-missing-alt`, `no-missing-lang` |
| `security` | `warn` | `no-set-html` |
| `best-practices` | `warn` | `prefer-class-list`, `no-process-env`, `prefer-content-collections` |
