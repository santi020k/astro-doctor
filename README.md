# Astro Doctor

> Your agent writes bad Astro. This catches it.

[![CI](https://github.com/santi020k/astro-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/santi020k/astro-doctor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/astro-doctor)
[![npm downloads](https://img.shields.io/npm/dt/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/astro-doctor)
[![license](https://img.shields.io/npm/l/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://github.com/santi020k/astro-doctor/blob/main/LICENSE)

Astro Doctor deterministically scans your Astro codebase and catches issues across **performance**, **accessibility**, **security**, and **best practices** — before they reach production. It scores your project health (0–100), teaches your coding agent Astro patterns, and reports new issues directly on PRs.

Works as a **CLI**, an **ESLint plugin**, and a **GitHub Action**.

---

## Install

### 1. Quick scan (no install needed)

```bash
npx @santi020k/astro-doctor@latest
```

Sample output:

```text
Scanning /my-project...

  src/pages/index.astro  12:3  warning  Prefer client:idle over client:load  (no-client-load-overuse)
  src/components/Hero.astro  5:1  warning  Use <Image> from astro:assets  (use-astro-image)

2 problems (0 errors, 2 warnings) across 14 files

Astro Doctor Score: 86/100 (B) 🟢
```

### 2. Install the ESLint plugin

For inline editor diagnostics via ESLint:

```bash
npm install -D @santi020k/eslint-plugin-astro-doctor
```

```js
// eslint.config.js
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

export default [
  astroDoctorPlugin.configs.recommended,
]
```

### 3. Install agent skills

Once you have a scan, install skills so your coding agent learns from the findings:

```bash
npx @santi020k/astro-doctor@latest install
```

This copies skills to your project that work with Claude Code, Cursor, Codex, OpenCode, and any `AGENTS.md`-compatible tool.

### 4. Run in CI (GitHub Actions)

On pull requests, Astro Doctor reports only issues **introduced by your change** — not pre-existing ones — and posts a sticky summary comment that updates in-place.

```yaml
name: Astro Doctor

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: astro-doctor-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  astro-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # required for diff mode
      - uses: santi020k/astro-doctor@v1
```

Pin to a commit SHA for hardened CI:

```yaml
- uses: santi020k/astro-doctor@<sha> # v1.x.x
```

---

## Rules

### Performance

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `no-client-load-overuse` | ⚠️ warning | Prefer `client:idle` or `client:visible` over `client:load` |
| `use-astro-image` | ⚠️ warning | Use `<Image>` from `astro:assets` instead of raw `<img>` |
| `no-blocking-script` | ⚠️ warning | Add `defer`, `async`, or `type="module"` to `<script src="...">` tags |

### Accessibility

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `no-missing-alt` | ❌ error | All image elements must have an `alt` attribute |
| `no-missing-lang` | ❌ error | The `<html>` element must have a `lang` attribute |

### Security

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `no-set-html` | ⚠️ warning | `set:html` is a potential XSS vector — sanitize before use |

### Best Practices

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `prefer-class-list` | ⚠️ warning | Use `class:list` instead of template literals for dynamic class names |
| `no-process-env` | ⚠️ warning | Use `import.meta.env` instead of `process.env` in Astro files |
| `prefer-content-collections` | ⚠️ warning | Use Content Collections instead of `Astro.glob()` for typed, cached content |

---

## Health Score

Every scan produces a score from **0 to 100** with a letter grade (A–F).

The score penalizes errors (×10) and warnings (×3) per file, so the penalty scales with issue density rather than raw count — large projects aren't punished just for having more files.

| Grade | Score | Meaning |
|-------|-------|---------|
| A ✅ | 90–100 | Excellent |
| B 🟢 | 75–89 | Good |
| C 🟡 | 60–74 | Fair |
| D 🟠 | 40–59 | Needs attention |
| F 🔴 | 0–39 | Critical |

Use `--no-score` to hide the score from output.

---

## CLI Reference

```bash
# Scan the current directory
npx @santi020k/astro-doctor@latest

# Scan a specific path
npx @santi020k/astro-doctor@latest --dir ./src

# Output a JSON report (to stdout)
npx @santi020k/astro-doctor@latest --json

# Output a JSON report to a file
npx @santi020k/astro-doctor@latest --json ./report.json

# Fail on warnings too (default: only errors)
npx @santi020k/astro-doctor@latest --fail-on warning

# Hide the health score
npx @santi020k/astro-doctor@latest --no-score

# Install agent skills
npx @santi020k/astro-doctor@latest install

# Experimental language server (LSP)
npx @santi020k/astro-doctor@latest experimental-lsp --stdio

# Show help
npx @santi020k/astro-doctor@latest --help
```

---

## Configuration

Create a `doctor.config.ts` (or `.js`, `.mjs`, `.cjs`, `.json`, `.jsonc`) in your project root:

```ts
// doctor.config.ts
import type { AstroDoctorConfig } from '@santi020k/astro-doctor'

export default {
  rules: {
    // Promote to error — no client:load allowed in this project
    'astro-doctor/no-client-load-overuse': 'error',
    // Disable if you sanitize set:html globally
    'astro-doctor/no-set-html': 'off',
  },
  ignore: ['src/legacy/**'],
  failOn: 'error',
} satisfies AstroDoctorConfig
```

Or in JSON:

```json
{
  "$schema": "https://doctor.santi020k.com/schema/config.json",
  "rules": {
    "astro-doctor/no-client-load-overuse": "error"
  }
}
```

---

## GitHub Action Reference

```yaml
- uses: santi020k/astro-doctor@v1
  with:
    working-directory: '.'      # directory to scan
    fail-on: 'error'            # error | warning | off
    comment: 'true'             # post sticky PR summary comment
    diff-only: 'true'           # on PRs, scan only changed .astro files
    json-report: ''             # path to write JSON report (optional)
```

**Outputs:**

| Output | Description |
|--------|-------------|
| `total` | Total diagnostics found |
| `errors` | Error-severity count |
| `warnings` | Warning-severity count |
| `score` | Health score 0–100 |
| `score-label` | Letter grade (A–F) |

---

## Editor Integrations

### VS Code & Cursor

Astro Doctor has an official extension for VS Code and Cursor. It provides:
- **Live Diagnostics:** Real-time linting as you type.
- **Quick Fixes:** Automatically fix common Astro anti-patterns.
- **Health Sidebar:** A visual health report with a score ring and category breakdown inside the VS Code Sidebar.
- **Hover Info:** Detailed explanations when hovering over issues.

Commands available in the Command Palette:
- `Astro Doctor: Scan Workspace`
- `Astro Doctor: Scan Current File`
- `Astro Doctor: Suppress All Issues in File`

### Other Editors (Experimental LSP)

Any LSP-capable editor (like Zed or Neovim) can run the language server directly over stdio:

```bash
astro-doctor experimental-lsp --stdio
```

> The LSP is experimental — its protocol may change between releases.

---

## Agent Skills

Three skills are available for coding agents:

| Skill | Location | Description |
|-------|----------|-------------|
| Astro Rules | `.agents/skills/astro-rules/` | All 9 rules with before/after examples |
| Astro Performance | `.agents/skills/astro-performance/` | Islands architecture patterns |
| Add Rule | `.agents/skills/add-rule/` | How to add a new rule to astro-doctor |

Install all of them:

```bash
npx @santi020k/astro-doctor@latest install
```

---

## Packages

| Package | Description |
| ------- | ----------- |
| [`@santi020k/astro-doctor`](./packages/astro-doctor) | CLI tool + public API |
| [`@santi020k/eslint-plugin-astro-doctor`](./packages/eslint-plugin-astro-doctor) | ESLint plugin with all rules |

---

## Development

```bash
pnpm install    # Install dependencies
pnpm run build  # Build all packages
pnpm run test   # Run tests (TDD: tests were written before implementations)
pnpm run lint   # Run ESLint + CSpell + Knip
pnpm run ok     # Full check: build + test + lint + typecheck
```

---

## Credits & Inspiration

Astro Doctor was inspired by **[react-doctor](https://github.com/millionco/react-doctor)** by [Million Software, Inc](https://million.dev).

react-doctor is a fantastic tool that deterministically scans React codebases for performance, security, and accessibility issues. It introduced the diagnostic CLI for framework-specific anti-patterns, the PR diff mode that reports only new issues, the sticky summary comment, the JSON report format, the health score, and the installable agent skill format.

Astro Doctor brings the same philosophy to [Astro](https://astro.build). If you work with React, go check out [react-doctor](https://github.com/millionco/react-doctor) — it's excellent.

ESLint configuration powered by [`@santi020k/eslint-config-basic`](https://github.com/santi020k/eslint-config-basic).

---

## License

MIT — [santi020k](https://santi020k.com)
