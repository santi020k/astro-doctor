# Framework Contracts

Read only the section for the app's target.

## Astro

Install and load styles once:

```bash
pnpm add @santi020k/lumen-astro
```

```astro
---
import { Button, Card, Field, Input, Label, UIPrimitives } from '@santi020k/lumen-astro'
import '@santi020k/lumen-astro/styles.css'
---

<UIPrimitives />

<Card>
  <Field>
    <Label for="email">Email</Label>
    <Input id="email" name="email" type="email" required />
  </Field>
  <Button type="submit">Continue</Button>
</Card>
```

Mount `UIPrimitives` once in the root layout when the app uses enhanced interactions. Do not place
it beside every primitive. Use public `data-ui-*` attributes documented by the selected component
for triggers and relationships. `CodeTabs` receives its persistence and synchronized keyboard
behavior from this single runtime instance.

## React

Install and load styles once from the app entry or global stylesheet:

```bash
pnpm add @santi020k/lumen-react
```

```tsx
import '@santi020k/lumen-react/styles.css'
import { Button, Card, Field, Input, Label } from '@santi020k/lumen-react'

export function SignInForm() {
  return (
    <Card>
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </Field>
      <Button type="submit">Continue</Button>
    </Card>
  )
}
```

Use Lumen's behavior hooks for interactive contracts instead of mounting Astro's progressive
enhancement runtime. Available hooks include behavior for dialogs, popovers, dropdown menus, tabs,
selects, tooltips, toasts, calendars, forms, data views, editors, schedules, resizable panes, and
other behavior-heavy primitives. `CodeTabs` owns its React state, copy controls, persistence, and
cross-instance synchronization. Inspect the current package exports before selecting a hook.

## Web Components

Install, load styles, and register once:

```bash
pnpm add @santi020k/lumen-elements
```

```html
<script type="module">
  import '@santi020k/lumen-elements/styles.css'
  import { defineLumenElements } from '@santi020k/lumen-elements/define'

  defineLumenElements()
</script>

<lumen-card>
  <label for="email">Email</label>
  <lumen-input id="email" name="email" type="email" required></lumen-input>
  <lumen-button type="submit">Continue</lumen-button>
</lumen-card>
```

In a bundled app, prefer importing `@santi020k/lumen-elements/styles.css` from the global CSS or
entry module instead of writing a literal package path in HTML. Registered elements provide the
matching behavior layer; do not add a parallel interaction library for the same primitive.

## Shared Rules

- Use direct named imports from the selected framework package.
- Install `@santi020k/lumen` separately only for the framework-neutral registry or CLI.
- Keep Tailwind optional. When present, import Lumen alongside Tailwind in the shared CSS entry.
- Use native attributes such as `required`, `type`, `min`, `max`, `pattern`, `aria-*`, and `data-*`
  where the component contract permits them.
- Keep state in the host framework or app. Lumen supplies primitives and behavior contracts, not
  product-specific data architecture.
