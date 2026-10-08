<p align="center">
  <a href="../../README.md">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../docs/assets/readme/workspace-dark.svg">
      <img src="../../docs/assets/readme/workspace-light.svg" alt="Astro Doctor — Clear diagnostics. Healthier Astro projects." width="1200" height="220">
    </picture>
  </a>
</p>

<h1 align="center">Oxlint configuration</h1>

<p align="center">
  <a href="https://npmjs.com/package/@santi020k/oxlint-config-astro-doctor"><img src="https://img.shields.io/npm/v/@santi020k/oxlint-config-astro-doctor.svg?style=flat-square&amp;color=a55117" alt="npm version"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/license-MIT-13967e?style=flat-square" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://github.com/santi020k/astro-doctor/blob/main/README.md">Project overview</a> ·
  <a href="https://github.com/santi020k/astro-doctor/blob/main/packages/oxlint-config-astro-doctor/package.json">Package manifest</a> ·
  <a href="https://github.com/santi020k/astro-doctor/blob/main/packages/oxlint-config-astro-doctor/CHANGELOG.md">Changelog</a> ·
  <a href="#resources">Resources</a>
</p>

**On this page:** [Install](#install) · [Usage](#usage) · [License](#license) · [Resources](#resources)

> Oxlint configuration for the built-in rules that overlap with Astro Doctor checks.

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

## Resources

[Project overview](https://github.com/santi020k/astro-doctor/blob/main/README.md) · [License](https://github.com/santi020k/astro-doctor/blob/main/LICENSE)
