## Project Context

Astro Doctor is a diagnostic CLI and ESLint plugin for Astro codebases.
It was inspired by **[react-doctor](https://github.com/millionco/react-doctor)** by Million Software, Inc —
an excellent tool that does the same for React. Same concept, same philosophy, built for Astro.

ESLint configuration powered by [`@santi020k/eslint-config-basic`](https://github.com/santi020k/eslint-config-basic).

For a full AI context file, see `llms.txt`.

## General Rules

- MUST: Use `pnpm` for package management. Use `pnpm add` to install, `pnpm run SCRIPT` to execute.
- MUST: Use TypeScript interfaces over types.
- MUST: Use arrow functions over function declarations.
- MUST: Use kebab-case for files.
- MUST: Use descriptive variable names (avoid single-letter names or shorthands).
  - Example: for `.map()`, use `innerRule` instead of `r`
  - Example: instead of `el` use `elementNode`
- MUST: Never comment unless absolutely necessary.
  - Hacks must be prefixed with `// HACK: reason`
- MUST: Remove unused code; don't repeat yourself.
- MUST: Put all magic numbers in `constants.ts` using `SCREAMING_SNAKE_CASE` with unit suffixes.
- MUST: Put small utility functions in `utils/` with one utility per file.
- MUST: Do not type-cast (`as`) unless absolutely necessary.
- MUST: Use `Boolean()` over `!!`.
- MUST: Before adding a new rule, search for similar existing rules to avoid duplication.

## Package Layout

```text
packages/
  eslint-plugin-astro-doctor/   PUBLISHED  the ESLint plugin with Astro-specific rules
    src/
      rules/                    One file per rule
      utils/                    Shared rule utilities
      types.ts                  TypeScript interfaces for rule context
      index.ts                  Plugin entry: exports plugin + recommended config
    tests/
      rules/                    One test file per rule (TDD: tests written first)
  astro-doctor/                 PUBLISHED  the CLI
    bin/
      astro-doctor.ts           CLI entry point
    src/
      cli.ts                    CLI command definitions
      config.ts                 Config file loading (doctor.config.ts)
      lsp.ts                    runLsp() — experimental LSP server (diagnostics, hover, code actions)
      scanner/                  File discovery + ESLint orchestration
      report/                   Console and JSON reporters
      index.ts                  Public programmatic API (scan())
    tests/                      CLI + scanner tests
  vscode-astro-doctor/          PRIVATE    VS Code extension
    src/
      extension.ts              Extension entry + LSP client setup + status bar
      sidebar-provider.ts       Sidebar health panel webview (score ring, category breakdown)
    scripts/
      vsce-package.cjs          Resolves catalog: refs before packaging with vsce
```

## ESLint Rule Conventions

- Every rule file exports a single `Rule.RuleModule` as default.
- Use `createRule()` from `utils/rule.ts` for consistent rule creation.
- Rule names use kebab-case: `no-client-load-overuse`, `use-astro-image`.
- Every rule must have: `meta.type`, `meta.docs.description`, `meta.messages`, `meta.schema`.
- Rules that target `.astro` template nodes check `context.filename` ends with `.astro`.
- Category taxonomy: `performance`, `accessibility`, `security`, `best-practices`, `architecture`.

## Testing

Tests live in each package's `tests/` directory. Framework is `vitest`.

- `packages/eslint-plugin-astro-doctor/tests/rules/` — one test file per rule using ESLint's `RuleTester`.
- `packages/astro-doctor/tests/` — scanner and CLI tests.

Run all checks before committing:

```bash
pnpm test       # all packages
pnpm lint
pnpm typecheck
```

## Astro-Specific Knowledge

### Client Directives (Performance)
- `client:load` — hydrates immediately on page load. Most aggressive; use sparingly.
- `client:idle` — hydrates after the page is done with initial load. Preferred for non-critical UI.
- `client:visible` — hydrates when the component enters the viewport. Best for below-the-fold content.
- `client:media` — hydrates based on a CSS media query.
- `client:only` — skips SSR entirely; renders only on the client.

### Image Optimization
- Prefer `<Image>` or `<Picture>` from `astro:assets` over raw `<img>`.
- `<Image>` enforces `alt`, `width`, `height`, and runs build-time optimization.

### Security
- `set:html` injects raw HTML — potential XSS if the value is user-controlled.
- Always sanitize values passed to `set:html`.

### Content Collections
- Prefer `getCollection()` / `getEntry()` over direct `import.meta.glob()` for typed, validated content.

## Imported Claude Cowork project instructions
