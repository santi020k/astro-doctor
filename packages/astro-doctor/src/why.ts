import { resolve } from 'node:path'

import { scan } from './scanner/index.js'
import { loadConfig } from './config.js'

const RULE_EXPLANATIONS: Record<string, { why: string; fix: string }> = {
  'no-blocking-script': {
    why: 'A <script src="..."> without defer, async, or type="module" blocks HTML parsing and delays page render. Browsers stop building the DOM until the script downloads and executes.',
    fix: 'Add defer, async, or type="module" to the script tag. For Astro-managed scripts, use <script> without src and let Astro handle bundling.',
  },
  'no-client-load-overuse': {
    why: 'client:load hydrates the component immediately on page load, even if the user never interacts with it. Overusing it ships unnecessary JavaScript to the browser.',
    fix: 'Use client:idle to hydrate when the browser is idle, or client:visible to hydrate only when the component enters the viewport.',
  },
  'use-astro-image': {
    why: 'Raw <img> tags skip Astro\'s image optimization pipeline. astro:assets automatically generates modern formats (WebP/AVIF), resizes images, and adds width/height to prevent layout shift.',
    fix: 'Replace <img src="..."> with <Image src={...} alt="..." /> from "astro:assets".',
  },
  'no-missing-alt': {
    why: 'Images without alt text are inaccessible to screen reader users and fail WCAG 2.1 criterion 1.1.1. Search engines also cannot index image content without alt text.',
    fix: 'Add a descriptive alt attribute: <img alt="Description of the image">. For decorative images use alt="".',
  },
  'no-missing-lang': {
    why: 'The lang attribute on <html> tells browsers and assistive technologies what language the page is in. Without it, screen readers may use the wrong voice and search engines may index the page in the wrong language.',
    fix: 'Add a lang attribute: <html lang="en"> (or the appropriate BCP 47 language tag).',
  },
  'no-set-html': {
    why: 'set:html inserts raw HTML directly into the DOM without sanitization. If the content includes user input, this is an XSS vulnerability.',
    fix: 'Avoid set:html with untrusted content. If you must use it, sanitize the input with a library like DOMPurify first, and add a comment explaining why it is safe.',
  },
  'no-process-env': {
    why: 'process.env is a Node.js API that is not available in all Astro rendering environments (SSR adapters, edge runtimes). It also bypasses Astro\'s type-safe env schema.',
    fix: 'Use import.meta.env.YOUR_VARIABLE instead, and define the variable in your .env file with the ASTRO_ prefix or via the env schema in astro.config.*.',
  },
  'prefer-class-list': {
    why: 'String concatenation for dynamic class names (`class={isActive ? "a b" : "a"}`) is error-prone and hard to read. class:list understands arrays, objects, and conditional values.',
    fix: 'Use <div class:list={["base", { active: isActive }]} /> instead of manual string concatenation.',
  },
  'prefer-content-collections': {
    why: 'Astro.glob() returns untyped data and must re-read the filesystem on every render. Content Collections are type-safe, support schema validation, and are optimized at build time.',
    fix: 'Replace Astro.glob("../content/**/*.md") with getCollection("your-collection") from "astro:content".',
  },
}

/**
 * Parse a file:line location string like "src/pages/index.astro:42"
 */
const parseLocation = (location: string): { filePath: string; line: number } | null => {
  const match = /^(.+):(\d+)$/u.exec(location)

  if (!match) return null

  return { filePath: match[1]!, line: Number.parseInt(match[2]!, 10) }
}

export const runWhy = async (location: string, cwd = process.cwd()): Promise<void> => {
  const parsed = parseLocation(location)

  if (!parsed) {
    console.error(`\nUsage: astro-doctor why <file>:<line>\nExample: astro-doctor why src/pages/index.astro:42\n`)
    process.exitCode = 1

    return
  }

  const absolutePath = resolve(cwd, parsed.filePath)
  const config = await loadConfig(cwd)

  const result = await scan({
    directory: cwd,
    files: [absolutePath],
    rules: config?.rules,
  })

  const atLine = result.diagnostics.filter((d) => d.line === parsed.line)
  const nearLine = result.diagnostics.filter(
    (d) => d.line !== parsed.line && Math.abs(d.line - parsed.line) <= 3,
  )

  if (atLine.length === 0 && nearLine.length === 0) {
    console.log(`\nNo Astro Doctor issues found at ${parsed.filePath}:${parsed.line}.\n`)

    if (result.diagnostics.length > 0) {
      console.log(`There are ${result.diagnostics.length} issue(s) in this file at other locations:\n`)

      for (const d of result.diagnostics) {
        const short = d.ruleId.replace('astro-doctor/', '')

        console.log(`  ${d.line}:${d.column}  ${d.severity}  ${d.message}  (${short})`)
      }

      console.log('')
    }

    return
  }

  const relevant = atLine.length > 0 ? atLine : nearLine
  const qualifier = atLine.length === 0 ? ` (nearest — within 3 lines of :${parsed.line})` : ''

  console.log(`\nAstro Doctor findings at ${parsed.filePath}:${parsed.line}${qualifier}:\n`)

  for (const d of relevant) {
    const short = d.ruleId.replace('astro-doctor/', '')
    const explanation = RULE_EXPLANATIONS[short]

    console.log(`  ${d.line}:${d.column}  [${d.severity}]  ${d.message}  (${short})\n`)

    if (explanation) {
      console.log(`  Why this matters:\n  ${explanation.why}\n`)
      console.log(`  How to fix:\n  ${explanation.fix}\n`)
    }
  }
}
