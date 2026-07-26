# @santi020k/astro-doctor

## 1.2.1

### Patch Changes

- [#16](https://github.com/santi020k/astro-doctor/pull/16) [`f7fa4a3`](https://github.com/santi020k/astro-doctor/commit/f7fa4a3395333206d1e97a7d58ae3a29016618fe) Thanks [@santi020k](https://github.com/santi020k)! - Remove the incompatible `eslint-plugin-jsx-a11y` dependency and align the runtime with `eslint-plugin-astro` 3 and `astro-eslint-parser` 3. Astro Doctor's proprietary accessibility diagnostics and official Astro rules remain enabled.

- Updated dependencies [[`f7fa4a3`](https://github.com/santi020k/astro-doctor/commit/f7fa4a3395333206d1e97a7d58ae3a29016618fe)]:
  - @santi020k/eslint-plugin-astro-doctor@1.2.1

## 1.2.0

### Minor Changes

- [#14](https://github.com/santi020k/astro-doctor/pull/14) [`b2f1dda`](https://github.com/santi020k/astro-doctor/commit/b2f1dda180897f5dd9db22b5f4194dd7c20b6eec) Thanks [@santi020k](https://github.com/santi020k)! - Make the GitHub Action skip comments for fork and Dependabot pull requests, add a native `min-score` quality gate, and remove its unused changed-files manifest.

### Patch Changes

- Updated dependencies [[`b2f1dda`](https://github.com/santi020k/astro-doctor/commit/b2f1dda180897f5dd9db22b5f4194dd7c20b6eec)]:
  - @santi020k/eslint-plugin-astro-doctor@1.2.0

## 1.1.0

### Minor Changes

- [#12](https://github.com/santi020k/astro-doctor/pull/12) [`e5bb5a7`](https://github.com/santi020k/astro-doctor/commit/e5bb5a7e455b6a00a509502e919212bf51cacd7d) Thanks [@santi020k](https://github.com/santi020k)! - Compose Astro Doctor with the official Astro ESLint ecosystem. The recommended preset now includes official recommended rules, strict adds accessibility, security, and best-practice checks, and the new all preset enables every non-deprecated upstream rule with automatic overlap deduplication.

- [#12](https://github.com/santi020k/astro-doctor/pull/12) [`c538858`](https://github.com/santi020k/astro-doctor/commit/c5388587f5b93d55de101c01f192db10cb127f74) Thanks [@santi020k](https://github.com/santi020k)! - Add project-aware audits for missing Astro Action input schemas, insecure session cookie overrides, and ClientRouter scripts that incorrectly rely on `DOMContentLoaded`.

- [#12](https://github.com/santi020k/astro-doctor/pull/12) [`d71e1d1`](https://github.com/santi020k/astro-doctor/commit/d71e1d1fb7584685b35aa7c904b244b51db1a7d4) Thanks [@santi020k](https://github.com/santi020k)! - Add safe automatic fixes and suggestions to the CLI and editor, official eslint-plugin-astro rule presets, baseline-aware changed scope, persistent baseline files, content-based scan caching, glob-based config overrides, SARIF output, strict CLI validation, verbose phase timings, and versioned JSON and baseline schemas. Harden the LSP with incremental document sync, debounced stale-result protection, configuration watching, workspace caching, and path-safe project selection. Category filters now score only visible diagnostics, GitHub workflows receive annotations, unresolved errors or unhealthy workspace projects cannot receive misleadingly high scores, and package-manager preference is opt-in.

### Patch Changes

- [#12](https://github.com/santi020k/astro-doctor/pull/12) [`a7e3981`](https://github.com/santi020k/astro-doctor/commit/a7e39817f5d48cc1413bae6a35ad008e894de792) Thanks [@santi020k](https://github.com/santi020k)! - Ignore diagnostics from ESLint rules that are not part of Astro Doctor's standalone scanner, and
  inherit pnpm package-manager configuration from a workspace root when auditing included nested
  projects. Package-manager audits now recognize npm, Yarn, and Bun lockfiles.

- [#12](https://github.com/santi020k/astro-doctor/pull/12) [`c538858`](https://github.com/santi020k/astro-doctor/commit/c5388587f5b93d55de101c01f192db10cb127f74) Thanks [@santi020k](https://github.com/santi020k)! - Fix current-file scanning and conflict-safe automatic fixes in the language server, restart the VS Code client when extension settings change, and escape dynamic sidebar content.

- [#12](https://github.com/santi020k/astro-doctor/pull/12) [`7269d52`](https://github.com/santi020k/astro-doctor/commit/7269d52d32c3258944f587acd88274b16dac3c8c) Thanks [@santi020k](https://github.com/santi020k)! - Make GitHub Action releases reproducible by running the matching CLI package version with a supported Node.js runtime, automate the floating `v1` action tag, and correct package metadata for the Node.js requirement already introduced by the Astro parser dependency in 1.0.3. The VS Code extension now requires VS Code 1.125 or newer, launches its bundled language server with the supported Node.js executable from the user's environment instead of VS Code's embedded runtime, and includes the cross-platform WASI compiler required by Astro Parser 3. Reduce false positives for explicit inline scripts, JSON-LD structured data, and runtime-populated images, and restore audit mode on ESLint 10.7.

- Updated dependencies [[`e5bb5a7`](https://github.com/santi020k/astro-doctor/commit/e5bb5a7e455b6a00a509502e919212bf51cacd7d), [`d71e1d1`](https://github.com/santi020k/astro-doctor/commit/d71e1d1fb7584685b35aa7c904b244b51db1a7d4)]:
  - @santi020k/eslint-plugin-astro-doctor@1.1.0

## 1.0.4

### Patch Changes

- [#9](https://github.com/santi020k/astro-doctor/pull/9) [`9501d73`](https://github.com/santi020k/astro-doctor/commit/9501d736c4d9933303e9436bc1d909491584c736) Thanks [@santi020k](https://github.com/santi020k)! - Make GitHub Action releases reproducible by running the matching CLI package version with a supported Node.js runtime, automate the floating `v1` action tag, and correct package metadata for the Node.js requirement already introduced by the Astro parser dependency in 1.0.3. The VS Code extension now requires VS Code 1.125 or newer, launches its bundled language server with the supported Node.js executable from the user's environment instead of VS Code's embedded runtime, and includes the cross-platform WASI compiler required by Astro Parser 3. Reduce false positives for explicit inline scripts, JSON-LD structured data, and runtime-populated images, and restore audit mode on ESLint 10.7.

- Updated dependencies []:
  - @santi020k/eslint-plugin-astro-doctor@1.0.4

## 1.0.3

### Patch Changes

- [#7](https://github.com/santi020k/astro-doctor/pull/7) [`2584508`](https://github.com/santi020k/astro-doctor/commit/2584508254b79826c8f212a5546cd2259e1a12f7) Thanks [@santi020k](https://github.com/santi020k)! - Update dependencies and support the JSX-shaped Astro AST introduced by `astro-eslint-parser` 3.

- Updated dependencies [[`2584508`](https://github.com/santi020k/astro-doctor/commit/2584508254b79826c8f212a5546cd2259e1a12f7)]:
  - @santi020k/eslint-plugin-astro-doctor@1.0.3

## 1.0.2

### Patch Changes

- [#5](https://github.com/santi020k/astro-doctor/pull/5) [`faeaf66`](https://github.com/santi020k/astro-doctor/commit/faeaf66ffc9b0f1470fb9bde5bbcbf0d361a70c4) Thanks [@santi020k](https://github.com/santi020k)! - Fix post-launch documentation and plugin meta accuracy

  - **eslint-plugin**: plugin `meta.version` now reads dynamically from `package.json` instead of being hardcoded to `0.1.0`
  - **docs/README/llms.txt**: corrected score formula description — each file is scored independently (errors cost 25 pts, warnings cost 10 pts, clamped per-file then averaged); previous docs described the old global density formula
  - **docs/README/action.yml**: updated score grade references from `A–F` to `S, A–F` to reflect that a perfect score of 100 returns the `S` grade; clarified that `S` means zero diagnostics — no issues found anywhere in the codebase (not just "high score" but truly clean); docs homepage grade cards now show a description label for each grade
  - **console reporter**: added missing `S: '🌟'` entry to `SCORE_EMOJI` — previously a perfect score would fall through to the `🟡` fallback
  - **GitHub Action PR comment**: same fix — `scoreEmoji` map now includes `S: '🌟'` so PR comments show the correct emoji for a clean codebase

- Updated dependencies [[`faeaf66`](https://github.com/santi020k/astro-doctor/commit/faeaf66ffc9b0f1470fb9bde5bbcbf0d361a70c4)]:
  - @santi020k/eslint-plugin-astro-doctor@1.0.2

## 1.0.1

### Patch Changes

- [`ac335ba`](https://github.com/santi020k/astro-doctor/commit/ac335ba21c803e5a287d0b4265cf4ef4515b254c) Thanks [@santi020k](https://github.com/santi020k)! - Fix VS Code extension publish and align package versions

- Updated dependencies [[`ac335ba`](https://github.com/santi020k/astro-doctor/commit/ac335ba21c803e5a287d0b4265cf4ef4515b254c)]:
  - @santi020k/eslint-plugin-astro-doctor@1.0.1

## 1.0.0

### Major Changes

- [`f1af77d`](https://github.com/santi020k/astro-doctor/commit/f1af77d53ba67a5b25b3d02b81dcc677af2403c6) Thanks [@santi020k](https://github.com/santi020k)! - Six improvements: per-file scoring, smarter client:load rule, derived rule categories, `--quiet` flag, scan error handling, and a better `--changed-files-from` warning.

  ## Breaking changes

  **`computeScore` signature changed** (`@santi020k/astro-doctor`)

  The exported `computeScore` function now takes `(diagnostics: readonly Diagnostic[], fileCount: number)` instead of `(errorCount: number, warningCount: number, fileCount: number)`. Update any direct calls to pass the diagnostics array.

  **`no-client-load-overuse` default behaviour changed** (`@santi020k/eslint-plugin-astro-doctor`)

  The rule now allows **one** `client:load` per file by default (`max: 1`). Previously it warned on every occurrence. To restore the old strict behaviour, add `"astro-doctor/no-client-load-overuse": ["warn", { "max": 0 }]` to your ESLint config.

  ## New features

  **Per-file scoring** — `computeScore` now scores each file independently (errors −10 pts, warnings −3 pts, clamped to [0, 100]) and averages the results. A single heavily-broken file in a large project no longer drags the overall score below its actual impact.

  **`no-client-load-overuse`: configurable `max` option** — Set `{ "max": N }` to allow up to N `client:load` usages per file before warning. `max: 0` reports every occurrence individually (old behaviour). `max: 1` (default) allows one per file and reports a single file-level message when exceeded, including the usage count.

  **Rule categories derived from plugin metadata** — The scanner no longer maintains a separate hard-coded `RULE_CATEGORY_MAP`. Categories are read directly from each rule's `meta.docs.category`, so new rules are automatically classified without any extra bookkeeping. This also fixes `prefer-content-collections` which was silently missing from the old map.

  **`--quiet` flag** — Pass `--quiet` to suppress warning diagnostics from console output. Errors are still shown, and the health score / exit-code thresholds still reflect all diagnostics.

  **Scan error handling** — If ESLint throws during a scan (e.g. a malformed `.astro` file), the CLI now prints a friendly error message and exits with code 1 instead of crashing with an unhandled exception.

  **`--changed-files-from` empty-list warning** — When the changed files list is non-empty but contains no `.astro` files, the CLI now prints a clear message and exits cleanly instead of silently returning a perfect score of 100.

### Minor Changes

- [`b070540`](https://github.com/santi020k/astro-doctor/commit/b0705405ea1df4e7e3deb8132ba1e42f8dee8312) Thanks [@santi020k](https://github.com/santi020k)! - Add four new ESLint rules covering performance, accessibility, and best practices.

  **`no-blocking-script`** (performance · warn) — Detects `<script src="...">` tags without `defer`, `async`, or `type="module"`. Render-blocking scripts delay First Contentful Paint and stall HTML parsing. Use `defer` to preserve execution order, `async` for independent scripts, or `type="module"` for always-deferred ES modules.

  **`no-missing-lang`** (accessibility · error) — Requires a `lang` attribute on the root `<html>` element. Missing `lang` is a WCAG 2.1 Level A failure (SC 3.1.1) that breaks screen reader language detection and search engine indexing.

  **`no-process-env`** (best-practices · warn) — Flags `process.env` usage in `.astro` files. `process.env` is Node.js-only and doesn't work in client-side code or respect Astro's `PUBLIC_` prefix visibility rules. Use `import.meta.env` instead.

  **`prefer-content-collections`** (best-practices · warn) — Flags `Astro.glob()` usage for content files. `Astro.glob()` returns untyped frontmatter objects. Use `getCollection()` from `astro:content` instead for TypeScript types, build-time validation, and caching.

### Patch Changes

- Updated dependencies [[`b070540`](https://github.com/santi020k/astro-doctor/commit/b0705405ea1df4e7e3deb8132ba1e42f8dee8312), [`f1af77d`](https://github.com/santi020k/astro-doctor/commit/f1af77d53ba67a5b25b3d02b81dcc677af2403c6)]:
  - @santi020k/eslint-plugin-astro-doctor@1.0.0
