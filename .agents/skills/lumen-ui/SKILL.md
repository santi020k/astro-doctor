---
name: lumen-ui
description: Build, restyle, review, or migrate product interfaces with the Lumen UI component library for Astro, React, or standards-based Web Components. Use when a request mentions Lumen UI, @santi020k/lumen packages, Lumen components or tokens, or asks an AI agent to create an accessible interface that should use Lumen instead of inventing primitives.
---

# Lumen UI

Build interfaces from Lumen's real component contracts, semantic tokens, and framework adapters.
Treat Astro as the reference surface, while following the user's existing stack.

## Workflow

1. Inspect the app before editing. Identify the framework, package manager, global style entry,
   existing Lumen packages, theme overrides, and local component conventions.
2. Choose the matching target:
   - Astro: `@santi020k/lumen-astro`
   - React: `@santi020k/lumen-react`
   - Web Components or framework-neutral HTML: `@santi020k/lumen-elements`
3. Retrieve current contracts before guessing:
   - Prefer connected Lumen MCP tools: search or list first, then read the selected component,
     tokens, and agent rules.
   - Otherwise inspect installed package types/source or use the Lumen CLI and online docs.
   - Never invent a component, prop, variant, event, or import path from memory.
4. Plan the interface as product structure and states, then map each part to the smallest suitable
   Lumen primitive. Read [references/component-selection.md](references/component-selection.md)
   when choosing components or composing a full screen.
5. Read [references/frameworks.md](references/frameworks.md) for setup and runtime rules for the
   selected target.
6. Implement with semantic markup and Lumen components. Import the framework stylesheet once.
   Preserve the app's state, routing, data, and domain logic.
7. Customize through Lumen tokens and public props. Read
   [references/design-system.md](references/design-system.md) when theming, polishing, or reviewing
   visual quality.
8. Verify the edited surface with the narrowest relevant typecheck, test, lint, and visual or
   browser check available in the project.

## Non-negotiable Rules

- Prefer existing Lumen primitives over hand-built replacements.
- Prefer Astro only for a new project with no requested framework; do not migrate an existing app
  merely because Astro is the reference implementation.
- Load the matching package stylesheet once at the app boundary.
- Mount `UIPrimitives` once in an Astro root layout when interactive primitives are present.
- Use React behavior hooks for behavior-heavy React primitives; do not mount the Astro runtime.
- Register Lumen custom elements once before using `lumen-*` elements.
- Use accessible names, native semantics, visible focus, keyboard paths, and meaningful empty,
  loading, error, success, disabled, and destructive states.
- Use Lucide names through Lumen's `Icon`; do not substitute emoji for interface icons.
- Use only the public semantic color vocabulary. Do not hardcode a second palette into component
  markup.
- Keep glass surfaces selective and legible. Decorative styling must not obscure behavior.
- Do not replace working app architecture or add dependencies unrelated to the requested interface.

## Discovery Without MCP

If Lumen is installed, inspect its exported types and package README. Otherwise use:

```bash
pnpm exec lumen list
pnpm exec lumen show Button
```

Use the project's package-manager equivalent of `lumen show <name>` before relying on an unfamiliar
component. Component names also accept kebab-case aliases such as `data-table`. If the CLI is not
installed, use the public documentation or GitHub source below.

Current public documentation:

- `https://lumen.santi020k.com/docs`
- `https://lumen.santi020k.com/docs/components`
- `https://github.com/santi020k/lumen/blob/main/docs/ai-usage.md`

## Completion Check

Before handing off, confirm that the chosen components and props exist, imports match the target
framework, styles and runtime setup occur only once, semantic tokens replace ad hoc colors, and the
primary interaction works with keyboard and focus as well as pointer input.
