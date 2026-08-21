# Astro Doctor for VS Code

## 1.3.1

### Patch Changes

- [#25](https://github.com/santi020k/astro-doctor/pull/25) [`29d3a0a`](https://github.com/santi020k/astro-doctor/commit/29d3a0a7ba3f62e1bf220e7bbc2136724f57afac) Thanks [@santi020k](https://github.com/santi020k)! - Pin the composite GitHub Action's runtime dependencies to reviewed commit SHAs and refresh vulnerable transitive build dependencies.

## 1.3.0

### Minor Changes

- [`0695440`](https://github.com/santi020k/astro-doctor/commit/0695440af4c3ebd7ff29391e16991d51e22653fd) Thanks [@santi020k](https://github.com/santi020k)! - Improve package export and packed-install validation for published artifacts, including the dependencies bundled with the VS Code extension.

## 1.2.2

## 1.2.1

### Improved

- Updated the bundled Astro linting stack for compatibility with `eslint-plugin-astro` 3 and `astro-eslint-parser` 3.
- Kept Astro Doctor's accessibility diagnostics and official Astro rules enabled without relying on an incompatible JSX accessibility dependency.

## 1.2.0

### Improved

- Updated the bundled diagnostic engine and its release dependencies for more reliable marketplace installs.

## 1.1.0

### Added

- Added safe automatic fixes and suggestions directly in the editor.
- Added official `eslint-plugin-astro` rule presets and broader accessibility, security, and best-practice diagnostics.
- Added incremental document sync, configuration watching, workspace caching, and debounced diagnostics.

### Fixed

- Fixed current-file scanning and conflict-safe automatic fixes.
- Restarted the language client when extension settings change.
- Escaped dynamic sidebar content.

## 1.0.4

### Improved

- Added support for the Astro Parser 3 runtime used by the bundled language server.
- The extension now resolves a supported Node.js executable from the user's environment instead of relying on VS Code's embedded runtime.
- Included the cross-platform WASI compiler required to analyze Astro files.

### Fixed

- Reduced false positives for explicit inline scripts, JSON-LD structured data, and runtime-populated images.

## 1.0.3

### Fixed

- Added support for the JSX-shaped Astro syntax tree produced by `astro-eslint-parser` 3.

## 1.0.2

### Fixed

- Corrected score and grade metadata shown by Astro Doctor.
- Kept bundled plugin version information synchronized with the extension.

## 1.0.1

### Fixed

- Fixed marketplace publishing and aligned bundled package versions.

## 1.0.0

Initial release of Astro Doctor for VS Code.

### Highlights

- Live Astro diagnostics, hovers, and quick fixes.
- Workspace and current-file scans.
- A sidebar health report with per-category results.
- Performance, accessibility, security, architecture, and best-practice rules.
- Per-file health scoring that prevents one heavily broken file from distorting an entire project.
- Configurable `client:load` overuse detection.
