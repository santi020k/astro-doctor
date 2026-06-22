# @santi020k/oxlint-config-astro-doctor

## 1.0.2

## 1.0.1

### Patch Changes

- [`ac335ba`](https://github.com/santi020k/astro-doctor/commit/ac335ba21c803e5a287d0b4265cf4ef4515b254c) Thanks [@santi020k](https://github.com/santi020k)! - Fix VS Code extension publish and align package versions

## 0.1.0

### Minor Changes

- [`b070540`](https://github.com/santi020k/astro-doctor/commit/b0705405ea1df4e7e3deb8132ba1e42f8dee8312) Thanks [@santi020k](https://github.com/santi020k)! - Add four new ESLint rules covering performance, accessibility, and best practices.

  **`no-blocking-script`** (performance · warn) — Detects `<script src="...">` tags without `defer`, `async`, or `type="module"`. Render-blocking scripts delay First Contentful Paint and stall HTML parsing. Use `defer` to preserve execution order, `async` for independent scripts, or `type="module"` for always-deferred ES modules.

  **`no-missing-lang`** (accessibility · error) — Requires a `lang` attribute on the root `<html>` element. Missing `lang` is a WCAG 2.1 Level A failure (SC 3.1.1) that breaks screen reader language detection and search engine indexing.

  **`no-process-env`** (best-practices · warn) — Flags `process.env` usage in `.astro` files. `process.env` is Node.js-only and doesn't work in client-side code or respect Astro's `PUBLIC_` prefix visibility rules. Use `import.meta.env` instead.

  **`prefer-content-collections`** (best-practices · warn) — Flags `Astro.glob()` usage for content files. `Astro.glob()` returns untyped frontmatter objects. Use `getCollection()` from `astro:content` instead for TypeScript types, build-time validation, and caching.
