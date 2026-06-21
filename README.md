# Astro Doctor

> Your agent writes bad Astro. This catches it.

[![CI](https://github.com/santi020k/astro-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/santi020k/astro-doctor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/astro-doctor)
[![npm downloads](https://img.shields.io/npm/dt/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/astro-doctor)
[![license](https://img.shields.io/npm/l/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://github.com/santi020k/astro-doctor/blob/main/LICENSE)

Astro Doctor deterministically scans your Astro codebase and catches issues across **performance**, **accessibility**, **security**, **best practices**, and **architecture** — before they reach production.

Works as a **CLI**, an **ESLint plugin**, and a **GitHub Action**.

---

## Install

### 1. Quick scan (no install needed)

```bash
npx @santi020k/astro-doctor@latest
```

### 2. Install the ESLint plugin

Add the plugin to your project for inline editor diagnostics:

```bash
npm install -D @santi020k/eslint-plugin-astro-doctor
```

Then add it to your `eslint.config.js`:

```js
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

export default [
  ...astroDoctorPlugin.configs.recommended,
]
```

### 3. Install the agent skill

Once you have a scan, install the skill so your coding agent learns from the findings:

```bash
npx @santi020k/astro-doctor@latest install
```

Works with Claude Code, Cursor, Codex, and any `AGENTS.md`-compatible tool.

### 4. Run in CI (GitHub Actions)

```yaml
name: Astro Doctor

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  astro-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: santi020k/astro-doctor@v1
```

---

## Rules

### Performance

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `no-client-load-overuse` | ⚠️ warning | Prefer `client:idle` or `client:visible` over `client:load` |
| `use-astro-image` | ⚠️ warning | Use `<Image>` from `astro:assets` instead of raw `<img>` |

### Accessibility

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `no-missing-alt` | ❌ error | All image elements must have an `alt` attribute |

### Security

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `no-set-html` | ⚠️ warning | `set:html` is a potential XSS vector — sanitize before use |

### Best Practices

| Rule | Severity | Description |
| ---- | -------- | ----------- |
| `prefer-class-list` | ⚠️ warning | Use `class:list` instead of template literals for dynamic class names |

---

## Configuration

Create `astro-doctor.config.ts` in your project root:

```ts
import type { AstroDoctorConfig } from '@santi020k/astro-doctor'

export default {
  rules: {
    // Promote to error — no client:load allowed in this project
    'astro-doctor/no-client-load-overuse': 'error',
    // Disable if you sanitize set:html elsewhere
    'astro-doctor/no-set-html': 'off',
  },
} satisfies AstroDoctorConfig
```

---

## CLI Reference

```bash
# Scan the current directory
npx @santi020k/astro-doctor@latest

# Scan a specific path
npx @santi020k/astro-doctor@latest --dir ./src

# Show help
npx @santi020k/astro-doctor@latest --help
```

---

## Packages

| Package | Description |
| ------- | ----------- |
| [`@santi020k/astro-doctor`](./packages/astro-doctor) | CLI tool |
| [`@santi020k/eslint-plugin-astro-doctor`](./packages/eslint-plugin-astro-doctor) | ESLint plugin with all rules |

---

## Development

```bash
pnpm install    # Install dependencies
pnpm run build  # Build all packages
pnpm run test   # Run tests (TDD: tests were written before implementations)
pnpm run lint   # Run ESLint + CSpell + Knip
pnpm run ok     # Run all checks
```

---

## Credits & Inspiration

Astro Doctor was inspired by **[react-doctor](https://github.com/millionco/react-doctor)** by [Million Software, Inc](https://million.dev).

react-doctor is a fantastic tool that deterministically scans React codebases for performance, security, and accessibility issues. It popularised the idea of a dedicated diagnostic CLI for framework-specific anti-patterns and the installable agent skill format that teaches coding agents your codebase's rules.

Astro Doctor brings the same philosophy to [Astro](https://astro.build): Astro-specific rules, the same CLI experience, the same GitHub Action pattern, and the same agent skill workflow — all tailored to the islands architecture and Astro's unique primitives.

If you work with React, go check out [react-doctor](https://github.com/millionco/react-doctor) — it's excellent.

ESLint configuration powered by [`@santi020k/eslint-config-basic`](https://github.com/santi020k/eslint-config-basic).

---

## License

MIT — [santi020k](https://santi020k.com)
