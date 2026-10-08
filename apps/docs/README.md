<p align="center">
  <a href="../../README.md">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../../docs/assets/readme/workspace-dark.svg">
      <img src="../../docs/assets/readme/workspace-light.svg" alt="Astro Doctor — Clear diagnostics. Healthier Astro projects." width="1200" height="220">
    </picture>
  </a>
</p>

<h1 align="center">Documentation</h1>

<p align="center">
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/license-MIT-13967e?style=flat-square" alt="License: MIT"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/built_with-Astro-a55117?style=flat-square" alt="Built With: Astro"></a>
</p>

<p align="center">
  <a href="../../README.md">Project overview</a> ·
  <a href="package.json">Package manifest</a> ·
  <a href="#resources">Resources</a>
</p>

**On this page:** [Development](#development) · [Deploy](#deploy) · [Structure](#structure) · [Generated social images](#generated-social-images) · [Design and motion](#design-and-motion) · [Resources](#resources)

Documentation website for [astro-doctor](https://github.com/santi020k/astro-doctor), built with Astro and deployed to Cloudflare Pages.

## Development

```bash
pnpm run dev           # Start dev server at localhost:4321
pnpm run build         # Build and audit the production site
pnpm run preview       # Preview the production build
pnpm run check         # Run Astro type checks
pnpm exec playwright install chromium
pnpm run test:browser  # Build, then check routes and interactions in Chromium
```

## Deploy

Deploys automatically to Cloudflare Pages after successful CI for the exact current `main` revision.

**Required secrets:**

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages:Edit permission
- `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID

**First-time setup:**

1. Create a Cloudflare Pages project named `astro-doctor-docs` in your dashboard
2. Add the secrets to your GitHub repository

## Structure

```text
src/
  components/     Nav, Footer, DocsSidebar
  data/           rules.ts (rule definitions), nav.ts (sidebar nav)
  layouts/        Base.astro, Docs.astro
  pages/          index.astro (landing), docs/** (documentation)
  styles/         global.css + partials (design tokens, base, utilities)
public/
  favicon.svg
```

## Generated social images

The documentation uses `@santi020k/og` 1.2 presets and a route manifest with content-versioned
image URLs. Generation fingerprints include copy, assets, renderer configuration and the
library version, so regenerated cards invalidate social preview caches. Run the workspace
build to regenerate cards and verify the built metadata, images and sitemap audit.

## Design and motion

The documentation uses Lumen v4 with Astro Doctor's orange and amber identity, charcoal dark
surfaces, cream light canvas, and locally served Montserrat. The joined homepage identity tab,
solid surfaces, open rows, and typography follow the shared Santiago website and theme direction.
Reading pages use a compact header and a quieter sidebar. Keep colors in the semantic tokens in
`src/styles/partials/tokens.css`; do not copy another project's brand palette.

`Base.astro` loads Lumen styles and `UIPrimitives` once. Astro's `ClientRouter` handles page
navigation. Lumen `ScrollReveal`, `Sheet`, `CodeTabs`, `Code`, and the public
`runLumenViewTransition` helper supply interaction and motion. Reinitialize document-bound
listeners on `astro:page-load`, close overlays and abort listeners before swaps, and preserve
reduced-motion and no-JavaScript reading behavior. Use public props and `data-slot` hooks.

The browser suite covers every route in light/dark themes at mobile/desktop sizes, accessibility,
external link safety, theme persistence, package-manager keyboard behavior, clipboard commands,
mobile navigation, narrow/enlarged text layouts, and reading without JavaScript. Set
`DOCS_CAPTURE_DIR` to an absolute temporary directory to save full-page screenshots. Use
`PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` to run against installed Chrome during local development.

## Resources

[Project overview](../../README.md) · [License](../../LICENSE)
