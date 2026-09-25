/**
 * Pre-build OG image generator for astro-doctor docs.
 *
 * Generates one WebP OG card per page and writes them to public/og/ so
 * Astro serves them as static passthrough files with zero runtime cost.
 *
 * Run via: `pnpm run generate:og` (or automatically via the build script).
 * Set FORCE_OG=1 to regenerate files that already exist.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCards } from '@santi020k/og'
import { definePageMetadata } from '@santi020k/og/metadata'
import { definePresetConfig } from '@santi020k/og/presets'

import { ALL_RULES } from '../src/data/rules.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
// ─── Page specs ───────────────────────────────────────────────────────────────
const SPECS = []

const spec = (output, props) => SPECS.push(definePageMetadata({
  badge: props.type,
  category: props.category,
  description: props.description,
  image: { alt: `${props.title} — Astro Doctor`, output },
  pathname: output === 'index.webp' ? '/' : `/${output.replace(/\.webp$/u, '')}/`,
  title: props.title
}))

// Homepage
spec('index.webp', {
  title: 'Your agent writes bad Astro. This catches it.',
  description: 'ESLint rules, CLI, GitHub Action, and AI agent skills for diagnosing and fixing common Astro mistakes before they reach production.',
  type: 'Home'
})

// Docs — Getting Started
spec('docs.webp', {
  title: 'Introduction',
  description: 'What astro-doctor is, what it checks, and how it fits alongside eslint-plugin-astro in your Astro project.',
  type: 'Docs'
})

spec('docs/installation.webp', {
  title: 'Installation',
  description: 'Step-by-step setup for the CLI, ESLint plugin, VS Code extension, and GitHub Action. Zero config required.',
  type: 'Docs'
})

spec('docs/quick-start.webp', {
  title: 'Quick Start',
  description: 'Get astro-doctor running in your project in 5 minutes — scan, score, and integrate with CI.',
  type: 'Docs'
})

spec('docs/configuration.webp', {
  title: 'Configuration',
  description: 'Full reference for doctor.config.ts — custom rules, severity overrides, ignored paths, and per-project settings.',
  type: 'Docs'
})

// Docs — Reference
spec('docs/eslint-plugin.webp', {
  title: 'ESLint Plugin',
  description: 'The core engine behind Astro Doctor, available as a standalone ESLint plugin for any flat-config setup.',
  type: 'ESLint Plugin'
})

spec('docs/cli.webp', {
  title: 'CLI Reference',
  description: 'All astro-doctor CLI commands, flags, and examples — scan, score, JSON reports, and CI integration.',
  type: 'CLI'
})

spec('docs/github-action.webp', {
  title: 'GitHub Action',
  description: 'Drop astro-doctor into your CI pipeline with PR diff mode, sticky PR comments, and configurable failure thresholds.',
  type: 'GitHub Action'
})

spec('docs/vscode-extension.webp', {
  title: 'VS Code Extension',
  description: 'Inline diagnostics, hovers, quick fixes, status bar score, and a health sidebar — all inside VS Code and Cursor.',
  type: 'VS Code'
})

spec('docs/editor-integration.webp', {
  title: 'Editor Integration',
  description: 'LSP-based diagnostics, hovers, and quick fixes for VS Code, Cursor, Neovim, WebStorm, and any LSP-capable editor.',
  type: 'LSP'
})

spec('docs/agent-skills.webp', {
  title: 'Agent Skills',
  description: 'Teach Claude, Cursor, and Copilot Workspace the astro-doctor rule set so AI-generated Astro code follows best practices.',
  type: 'AI Skills'
})

spec('docs/changelog.webp', {
  title: 'Changelog',
  description: 'Release history for Astro Doctor packages, editor integrations, and automation.',
  type: 'Release History'
})

// Docs — Rules
spec('docs/rules.webp', {
  title: 'Rules Overview',
  description: 'All astro-doctor ESLint rules organized by category — performance, accessibility, security, and best-practices.',
  type: 'Rules'
})

for (const rule of ALL_RULES) {
  spec(`docs/rules/${rule.slug}.webp`, {
    title: rule.slug,
    description: rule.description,
    type: rule.category.replace('-', ' '),
    category: rule.category
  })
}

export default definePresetConfig({
  cards: createCards(SPECS, page => ({
    badge: page.badge,
    category: page.category,
    description: page.description,
    title: page.title,
    variant: 'docs'
  }), {
    output: page => page.image.output,
    route: page => ({
      alt: page.image.alt,
      description: page.description,
      pathname: page.pathname,
      schemaTypes: page.pathname === '/' ? ['SoftwareApplication'] : ['TechArticle'],
      title: page.title
    })
  }),
  clean: true,
  concurrency: 'auto',
  outputDirectory: 'public/og',
  routeManifest: { file: 'public/og/manifest.json', publicPath: '/og' },
  preset: {
    brand: {
      domain: 'astro-doctor.santi020k.com',
      logo: 'public/favicon.svg',
      name: 'Astro Doctor'
    },
    theme: {
      accent: '#fa832e',
      background: '#090b10',
      foreground: '#e9eaed',
      muted: '#a8abb3',
      panel: '#101319'
    },
    variant: 'docs'
  },
  root: ROOT
})
