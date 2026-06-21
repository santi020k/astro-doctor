export type RuleCategory = 'performance' | 'accessibility' | 'security' | 'best-practices'
export type Severity = 'error' | 'warn'

export interface RuleExample {
  readonly label: string
  readonly code: string
  readonly language?: string
}

export interface Rule {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly category: RuleCategory
  readonly severity: Severity
  readonly description: string
  readonly why: string
  readonly bad: RuleExample
  readonly good: RuleExample
  readonly options?: readonly string[]
}

export const RULES: readonly Rule[] = [
  {
    id: 'astro-doctor/no-client-load-overuse',
    name: 'no-client-load-overuse',
    slug: 'no-client-load-overuse',
    category: 'performance',
    severity: 'warn',
    description: 'Prefer client:idle or client:visible over client:load for interactive islands.',
    why: 'client:load hydrates the component immediately, blocking the main thread during page startup. client:idle waits for the browser to be idle; client:visible waits until the element enters the viewport — both give the critical path a head start.',
    bad: {
      label: 'Uses client:load unnecessarily',
      code: `---
import Counter from '../components/Counter'
---
<Counter client:load />`
    },
    good: {
      label: 'Uses client:idle (below the fold) or client:visible',
      code: `---
import Counter from '../components/Counter'
---
<!-- Below-the-fold component: hydrate when browser is idle -->
<Counter client:idle />

<!-- Only visible when scrolled into view -->
<Counter client:visible />`
    }
  },
  {
    id: 'astro-doctor/use-astro-image',
    name: 'use-astro-image',
    slug: 'use-astro-image',
    category: 'performance',
    severity: 'warn',
    description: 'Use <Image> from astro:assets instead of raw <img> tags.',
    why: 'The built-in <Image> component automatically optimises images (WebP/AVIF conversion, responsive srcset, lazy loading, explicit width/height to prevent layout shift). Plain <img> tags skip all of this.',
    bad: {
      label: 'Raw <img> tag',
      code: `---
---
<img src="/hero.png" alt="Hero image" />`
    },
    good: {
      label: '<Image> from astro:assets',
      code: `---
import { Image } from 'astro:assets'
import hero from '../assets/hero.png'
---
<Image src={hero} alt="Hero image" width={800} height={400} />`
    }
  },
  {
    id: 'astro-doctor/no-missing-alt',
    name: 'no-missing-alt',
    slug: 'no-missing-alt',
    category: 'accessibility',
    severity: 'error',
    description: 'All <img>, <Image>, and <Picture> elements must include an alt attribute.',
    why: 'Missing alt text leaves screen-reader users with no context for images. An empty alt="" is only acceptable for decorative images that carry no information.',
    bad: {
      label: 'No alt attribute',
      code: `---
import { Image } from 'astro:assets'
import logo from '../assets/logo.png'
---
<Image src={logo} width={120} height={40} />`
    },
    good: {
      label: 'Descriptive alt text',
      code: `---
import { Image } from 'astro:assets'
import logo from '../assets/logo.png'
---
<Image src={logo} alt="Astro Doctor logo" width={120} height={40} />`
    }
  },
  {
    id: 'astro-doctor/no-set-html',
    name: 'no-set-html',
    slug: 'no-set-html',
    category: 'security',
    severity: 'warn',
    description: 'Avoid set:html to prevent cross-site scripting (XSS) vulnerabilities.',
    why: 'set:html injects raw HTML into the DOM without escaping. Any user-controlled or third-party content rendered this way is an XSS vector. Use Astro\'s JSX interpolation (which escapes by default) or sanitize the content first.',
    bad: {
      label: 'Unsanitised HTML injection',
      code: `---
const userContent = await fetchUserBio()
---
<div set:html={userContent} />`
    },
    good: {
      label: 'Escaped interpolation (or sanitised HTML)',
      code: `---
import DOMPurify from 'dompurify'
const userContent = await fetchUserBio()
const safe = DOMPurify.sanitize(userContent)
---
{/* Escaped by default */}
<p>{plainTextContent}</p>

{/* Only if HTML rendering is truly required */}
<div set:html={safe} />`
    }
  },
  {
    id: 'astro-doctor/prefer-class-list',
    name: 'prefer-class-list',
    slug: 'prefer-class-list',
    category: 'best-practices',
    severity: 'warn',
    description: 'Use class:list directive for conditional or dynamic class names.',
    why: 'Template-literal class composition is error-prone (extra spaces, false-y values leaking). class:list is Astro\'s idiomatic way to build class strings — it handles objects, arrays, and conditionals correctly.',
    bad: {
      label: 'String concatenation / template literals',
      code: `---
const isActive = true
---
<button class={\`btn \${isActive ? 'btn-active' : ''}\`}>
  Click me
</button>`
    },
    good: {
      label: 'class:list directive',
      code: `---
const isActive = true
---
<button class:list={['btn', { 'btn-active': isActive }]}>
  Click me
</button>`
    }
  }
]

export const RULE_BY_SLUG = Object.fromEntries(RULES.map(rule => [rule.slug, rule]))

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  security: 'Security',
  'best-practices': 'Best Practices'
}

export const CATEGORY_COLORS: Record<RuleCategory, string> = {
  performance: 'badge-performance',
  accessibility: 'badge-accessibility',
  security: 'badge-security',
  'best-practices': 'badge-best-practices'
}
