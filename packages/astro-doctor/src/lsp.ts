/* eslint-disable @cspell/spellchecker */
/**
 * Experimental Language Server Protocol (LSP) integration for Astro Doctor.
 *
 * Streams diagnostics live into your editor as you type — underlined inline,
 * with rule descriptions on hover — in VS Code, Cursor, Zed, Neovim, Helix,
 * Emacs, Sublime, or any LSP-capable editor.
 *
 * Usage (universal):
 *   astro-doctor experimental-lsp --stdio
 *
 * VS Code / Cursor: install the companion extension (coming soon).
 * Zed: add to ~/.config/zed/settings.json (coming soon).
 *
 * cspell:disable-line
 * Neovim (nvim-lspconfig): use the `astro_doctor` server definition (coming soon).
 *
 * > The LSP is experimental — its protocol, options, and caching behavior may
 * > change between releases, hence the `experimental-` prefix.
 */

const EXPERIMENTAL_LSP_NOTICE = `
Astro Doctor — Experimental LSP

The language server is not yet available in this release.
Watch https://github.com/santi020k/astro-doctor for the announcement.

In the meantime, use the ESLint plugin for inline editor diagnostics:
  npm install -D @santi020k/eslint-plugin-astro-doctor

Then add to your eslint.config.js:
  import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'
  export default [...astroDoctorPlugin.configs.recommended]
`.trim()

export const runLsp = (): void => {
  console.error(EXPERIMENTAL_LSP_NOTICE)

  process.exitCode = 1
}
