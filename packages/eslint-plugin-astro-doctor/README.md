# @santi020k/eslint-plugin-astro-doctor

> ESLint plugin for Astro Doctor — Astro-specific rules for performance, accessibility, security, and best practices.

[![npm version](https://img.shields.io/npm/v/@santi020k/eslint-plugin-astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/eslint-plugin-astro-doctor)
[![npm downloads](https://img.shields.io/npm/dt/@santi020k/eslint-plugin-astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/eslint-plugin-astro-doctor)

## Install

```bash
npm install -D @santi020k/eslint-plugin-astro-doctor
# also requires astro-eslint-parser for .astro file parsing
npm install -D astro-eslint-parser
```

## Usage

### Recommended config (all rules, default severities)

```js
// eslint.config.js
import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

export default [
  astroDoctorPlugin.configs.recommended,
]
```

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
      'astro-doctor/no-missing-alt': 'error',
      'astro-doctor/no-set-html': 'warn',
      'astro-doctor/prefer-class-list': 'warn',
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

## Rules

| Rule | Category | Default |
| ---- | -------- | ------- |
| `no-client-load-overuse` | performance | ⚠️ warn |
| `use-astro-image` | performance | ⚠️ warn |
| `no-missing-alt` | accessibility | ❌ error |
| `no-set-html` | security | ⚠️ warn |
| `prefer-class-list` | best-practices | ⚠️ warn |

## See Also

- [Full documentation](https://github.com/santi020k/astro-doctor)
- [`@santi020k/astro-doctor`](https://npmjs.com/package/@santi020k/astro-doctor) — the CLI
- Inspired by [react-doctor](https://github.com/millionco/react-doctor) by Million Software, Inc

## License

MIT — [santi020k](https://santi020k.com)
