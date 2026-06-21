# astro-doctor docs

Documentation website for [astro-doctor](https://github.com/santi020k/astro-doctor), built with Astro and deployed to Cloudflare Pages.

## Development

```bash
pnpm dev          # Start dev server at localhost:4321
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm check        # Run astro check (type checking)
```

## Deploy

Deploys automatically to Cloudflare Pages on every push to `main` that touches `apps/docs/**`.

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
