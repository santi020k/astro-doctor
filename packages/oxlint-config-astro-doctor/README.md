# @santi020k/oxlint-config-astro-doctor

> Oxlint configuration for the built-in rules that overlap with Astro Doctor checks.

[![npm version](https://img.shields.io/npm/v/@santi020k/oxlint-config-astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/oxlint-config-astro-doctor)

## Install

```bash
pnpm add -D oxlint @santi020k/oxlint-config-astro-doctor
```

## Usage

```bash
pnpm exec oxlint --config node_modules/@santi020k/oxlint-config-astro-doctor/index.json src/
```

The configuration enables:

- `jsx-a11y/alt-text`
- `jsx-a11y/html-has-lang`
- `no-process-env`
- Oxlint's `correctness` and `suspicious` categories

Astro-specific checks without an Oxlint equivalent still require [`@santi020k/astro-doctor`](https://npmjs.com/package/@santi020k/astro-doctor) or [`@santi020k/eslint-plugin-astro-doctor`](https://npmjs.com/package/@santi020k/eslint-plugin-astro-doctor).

## License

MIT — [santi020k](https://santi020k.com)
