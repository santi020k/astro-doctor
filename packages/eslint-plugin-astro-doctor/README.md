<p align="center">
  <a href="../../README.md">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../docs/assets/readme/workspace-dark.svg">
      <img src="../../docs/assets/readme/workspace-light.svg" alt="Astro Doctor — Clear diagnostics. Healthier Astro projects." width="1200" height="220">
    </picture>
  </a>
</p>

<h1 align="center">ESLint plugin</h1>

<p align="center">
  <a href="https://npmjs.com/package/@santi020k/eslint-plugin-astro-doctor"><img src="https://img.shields.io/npm/v/@santi020k/eslint-plugin-astro-doctor.svg?style=flat-square&amp;color=a55117" alt="npm version"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/license-MIT-13967e?style=flat-square" alt="License: MIT"></a>
  <a href="https://npmjs.com/package/@santi020k/eslint-plugin-astro-doctor"><img src="https://img.shields.io/npm/dt/@santi020k/eslint-plugin-astro-doctor.svg?style=flat-square&amp;colorA=000000&amp;colorB=000000" alt="npm downloads"></a>
</p>

<p align="center">
  <a href="https://github.com/santi020k/astro-doctor/blob/main/README.md">Project overview</a> ·
  <a href="https://github.com/santi020k/astro-doctor/blob/main/packages/eslint-plugin-astro-doctor/package.json">Package manifest</a> ·
  <a href="https://github.com/santi020k/astro-doctor/blob/main/packages/eslint-plugin-astro-doctor/CHANGELOG.md">Changelog</a> ·
  <a href="#resources">Resources</a>
</p>

**On this page:** [Install](#install) · [Usage](#usage) · [Proprietary Rules](#proprietary-rules) · [See Also](#see-also) · [License](#license) · [Resources](#resources)

> ESLint plugin for Astro Doctor — Astro-specific rules for performance, accessibility, security, and best practices.

## Install

```bash
pnpm add -D @santi020k/eslint-plugin-astro-doctor
```

## Usage

### Presets

```js
// eslint.config.js
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

export default [
  astroDoctorPlugin.configs.recommended,
  // astroDoctorPlugin.configs.strict,
  // astroDoctorPlugin.configs.all,
]
```

- `recommended` enables the 13 proprietary rules plus the official Astro recommended rules.
- `strict` adds selected official Astro security and best-practice rules.
- `all` enables every non-deprecated official Astro rule, including stylistic rules.

Overlapping checks are automatically disabled so a problem is reported once. The `all` preset provides 63 unique ESLint checks: 13 proprietary rules plus 54 upstream rules, minus four overlaps.

### Manual config

```js
// eslint.config.js
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'
import * as astroParser from 'astro-eslint-parser'

export default [
  {
    files: ['**/*.astro'],
    plugins: { 'astro-doctor': astroDoctorPlugin },
    languageOptions: { parser: astroParser },
    rules: {
      'astro-doctor/no-client-load-overuse': 'warn',
      'astro-doctor/use-astro-image': 'warn',
      'astro-doctor/require-image-dimensions': 'warn',
      'astro-doctor/no-blocking-script': 'warn',
      'astro-doctor/no-unprocessed-script-surprises': 'warn',
      'astro-doctor/no-missing-alt': 'error',
      'astro-doctor/no-missing-lang': 'error',
      'astro-doctor/require-island-fallback': 'warn',
      'astro-doctor/no-public-secret-env': 'warn',
      'astro-doctor/no-set-html': 'warn',
      'astro-doctor/prefer-class-list': 'warn',
      'astro-doctor/no-process-env': 'warn',
      'astro-doctor/prefer-content-collections': 'warn',
    },
  },
]
```

### With `@santi020k/eslint-config-basic`

If your project already uses `@santi020k/eslint-config-basic`, Astro Doctor integrates directly:

```js
// eslint.config.js
import { defineConfig } from '@santi020k/eslint-config-basic'
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

export default await defineConfig({
  frameworks: { astro: true },
}, astroDoctorPlugin.configs.recommended)
```

## Proprietary Rules

| Rule                              | Category       | Default  |
| --------------------------------- | -------------- | -------- |
| `no-client-load-overuse`          | performance    | ⚠️ warn  |
| `use-astro-image`                 | performance    | ⚠️ warn  |
| `require-image-dimensions`        | performance    | ⚠️ warn  |
| `no-blocking-script`              | performance    | ⚠️ warn  |
| `no-unprocessed-script-surprises` | performance    | ⚠️ warn  |
| `no-missing-alt`                  | accessibility  | ❌ error |
| `no-missing-lang`                 | accessibility  | ❌ error |
| `require-island-fallback`         | accessibility  | ⚠️ warn  |
| `no-public-secret-env`            | security       | ⚠️ warn  |
| `no-set-html`                     | security       | ⚠️ warn  |
| `prefer-class-list`               | best-practices | ⚠️ warn  |
| `no-process-env`                  | best-practices | ⚠️ warn  |
| `prefer-content-collections`      | best-practices | ⚠️ warn  |

## See Also

- [Full documentation](https://github.com/santi020k/astro-doctor)
- [`@santi020k/astro-doctor`](https://npmjs.com/package/@santi020k/astro-doctor) — the CLI
- Inspired by [react-doctor](https://github.com/millionco/react-doctor) by Million Software, Inc

## License

MIT — [santi020k](https://santi020k.com)

## Resources

[Project overview](https://github.com/santi020k/astro-doctor/blob/main/README.md) · [License](https://github.com/santi020k/astro-doctor/blob/main/LICENSE)
