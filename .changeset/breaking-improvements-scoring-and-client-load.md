---
"@santi020k/astro-doctor": major
"@santi020k/eslint-plugin-astro-doctor": major
"vscode-astro-doctor": major
---

Six improvements: per-file scoring, smarter client:load rule, derived rule categories, `--quiet` flag, scan error handling, and a better `--changed-files-from` warning.

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
