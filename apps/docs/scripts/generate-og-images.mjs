/**
 * Pre-build OG image generator for astro-doctor docs.
 *
 * Generates one WebP OG card per page and writes them to public/og/ so
 * Astro serves them as static passthrough files with zero runtime cost.
 *
 * Run via: `pnpm run generate:og` (or automatically via the build script).
 * Set FORCE_OG=1 to regenerate files that already exist.
 */

import fs, { promises as fsp } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderOgCard } from './render-og-card.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'og')
const FORCE = process.env.FORCE_OG === '1'

// ─── Page specs ───────────────────────────────────────────────────────────────

/** @type {Array<{ outFile: string, props: object }>} */
const SPECS = []
const spec = (outRelPath, props) => SPECS.push({ outFile: path.join(OUT_DIR, outRelPath), props })

// Homepage
spec('index.webp', {
  title: 'Your agent writes bad Astro. This catches it.',
  description: 'ESLint rules, CLI, GitHub Action, and AI agent skills for diagnosing and fixing common Astro mistakes before they reach production.',
  type: 'Home'
})

// Docs — Getting Started
spec('docs/index.webp', {
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

// Docs — Rules
spec('docs/rules/index.webp', {
  title: 'Rules Overview',
  description: 'All astro-doctor ESLint rules organised by category — performance, accessibility, security, and best-practices.',
  type: 'Rules'
})

// Rule pages (slug, description, category mirror src/data/rules.ts)
const RULES = [
  { slug: 'no-client-load-overuse',        description: 'Prefer client:idle or client:visible over client:load for interactive islands.',              category: 'performance'     },
  { slug: 'use-astro-image',               description: 'Use <Image> from astro:assets instead of raw <img> tags.',                                    category: 'performance'     },
  { slug: 'require-image-dimensions',      description: 'Require explicit dimensions for public and remote astro:assets images.',                       category: 'performance'     },
  { slug: 'no-blocking-script',            description: 'Disallow render-blocking <script src="..."> tags — add defer, async, or type="module".',       category: 'performance'     },
  { slug: 'no-unprocessed-script-surprises', description: 'Warn when script attributes opt out of Astro\'s script processing pipeline.',               category: 'performance'     },
  { slug: 'no-missing-alt',               description: 'All <img>, <Image>, and <Picture> elements must include an alt attribute.',                     category: 'accessibility'   },
  { slug: 'no-missing-lang',              description: 'Require a lang attribute on the <html> element — a WCAG 2.1 Level A requirement.',              category: 'accessibility'   },
  { slug: 'require-island-fallback',      description: 'Require fallback content for client-only and deferred server islands.',                         category: 'accessibility'   },
  { slug: 'no-set-html',                  description: 'Avoid set:html to prevent cross-site scripting (XSS) vulnerabilities.',                        category: 'security'        },
  { slug: 'no-public-secret-env',         description: 'Warn when PUBLIC_ environment variables appear to contain secrets.',                           category: 'security'        },
  { slug: 'prefer-class-list',            description: 'Use class:list directive for conditional or dynamic class names.',                              category: 'best-practices'  },
  { slug: 'no-process-env',              description: 'Disallow process.env in Astro files — use import.meta.env instead.',                            category: 'best-practices'  },
  { slug: 'prefer-content-collections',  description: 'Prefer Content Collections over Astro.glob() or import.meta.glob() for Markdown and MDX.',      category: 'best-practices'  }
]

for (const rule of RULES) {
  spec(`docs/rules/${rule.slug}.webp`, {
    title: rule.slug,
    description: rule.description,
    type: rule.category.replace('-', ' '),
    category: rule.category
  })
}

// ─── Generator ────────────────────────────────────────────────────────────────

const generateOne = async ({ outFile, props }) => {
  if (!FORCE && fs.existsSync(outFile)) return

  const buffer = await renderOgCard(props)

  await fsp.mkdir(path.dirname(outFile), { recursive: true })

  await fsp.writeFile(outFile, buffer)

  process.stdout.write(`  write ${path.relative(ROOT, outFile)}\n`)
}

const start = performance.now()
const pending = FORCE ? SPECS : SPECS.filter(s => !fs.existsSync(s.outFile))

console.log(`\n🖼  Generating ${pending.length}/${SPECS.length} OG images…\n`)

await Promise.all(pending.map(generateOne))

const elapsed = ((performance.now() - start) / 1000).toFixed(2)

console.log(`\n✅ Done in ${elapsed}s\n`)
