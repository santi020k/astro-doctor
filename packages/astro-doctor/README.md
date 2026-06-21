# @santi020k/astro-doctor

> Your agent writes bad Astro. This catches it.

[![npm version](https://img.shields.io/npm/v/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/astro-doctor)
[![npm downloads](https://img.shields.io/npm/dt/@santi020k/astro-doctor.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@santi020k/astro-doctor)

The CLI for Astro Doctor — scans your Astro project and reports issues across performance, accessibility, security, and best practices.

## Quick Start

```bash
# One-time scan (no install)
npx @santi020k/astro-doctor@latest

# Scan a specific directory
npx @santi020k/astro-doctor@latest --dir ./src

# Install the agent skill after scanning
npx @santi020k/astro-doctor@latest install
```

## Programmatic API

```ts
import { scan, formatConsoleReport } from '@santi020k/astro-doctor'

const result = await scan({ directory: './src' })

console.log(formatConsoleReport(result))
// result.diagnostics  — array of findings
// result.errorCount   — number of errors
// result.warningCount — number of warnings
// result.fileCount    — number of .astro files scanned
```

## GitHub Actions

```yaml
- uses: santi020k/astro-doctor@v1
  with:
    fail-on: error   # error | warning | off
```

## See Also

- [Full documentation](https://github.com/santi020k/astro-doctor)
- [`@santi020k/eslint-plugin-astro-doctor`](https://npmjs.com/package/@santi020k/eslint-plugin-astro-doctor) — the underlying ESLint plugin
- Inspired by [react-doctor](https://github.com/millionco/react-doctor) by Million Software, Inc

## License

MIT — [santi020k](https://santi020k.com)
