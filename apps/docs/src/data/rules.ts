export type RuleCategory = 'performance' | 'accessibility' | 'security' | 'best-practices' | 'architecture'
export type Severity = 'error' | 'warn'
export type RuleExampleLanguage = 'astro' | 'json' | 'text' | 'typescript'

export interface RuleExample {
  readonly label: string
  readonly code: string
  readonly language?: RuleExampleLanguage
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

export interface ProjectAuditRule extends Rule {
  readonly preset: 'recommended' | 'strict' | 'opt-in'
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
    why: 'The built-in <Image> component automatically optimizes images (WebP/AVIF conversion, responsive srcset, lazy loading, explicit width/height to prevent layout shift). Plain <img> tags with static sources skip all of this. Source-less placeholders populated at runtime are ignored because they cannot be optimized at build time.',
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
    id: 'astro-doctor/require-image-dimensions',
    name: 'require-image-dimensions',
    slug: 'require-image-dimensions',
    category: 'performance',
    severity: 'warn',
    description: 'Require dimensions for public and remote astro:assets images.',
    why: 'Astro can infer dimensions for imported images from src/, but it cannot analyze files served from public/ and needs dimensions or inferSize for remote images. Missing dimensions can cause layout shift while the image loads.',
    bad: {
      label: 'Public image without dimensions',
      code: `---
import { Image } from 'astro:assets'
---
<Image src="/hero.png" alt="Hero image" />`
    },
    good: {
      label: 'Public image with dimensions',
      code: `---
import { Image } from 'astro:assets'
---
<Image src="/hero.png" alt="Hero image" width="1200" height="630" />

<Image src="https://cdn.example.com/hero.png" alt="Hero image" inferSize />`
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
    why: 'set:html injects raw HTML into the DOM without escaping. Any user-controlled or third-party content rendered this way is an XSS vector. Use Astro\'s JSX interpolation, which escapes by default. JSON-LD data scripts are accepted when they use type="application/ld+json".',
    bad: {
      label: 'Unsanitized HTML injection',
      code: `---
const userContent = await fetchUserBio()
---
<div set:html={userContent} />`
    },
    good: {
      label: 'Escaped interpolation or JSON-LD data',
      code: `---
const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Example',
}).replace(/</g, '\\u003c')
---
{/* Escaped by default */}
<p>{plainTextContent}</p>

{/* Non-executable structured data */}
<script type="application/ld+json" set:html={structuredData}></script>`
    }
  },
  {
    id: 'astro-doctor/no-public-secret-env',
    name: 'no-public-secret-env',
    slug: 'no-public-secret-env',
    category: 'security',
    severity: 'warn',
    description: 'Warn when PUBLIC_ environment variables appear to contain secrets.',
    why: 'Astro exposes PUBLIC_ environment variables to client-side code. Names like PUBLIC_TOKEN, PUBLIC_SECRET, PUBLIC_PASSWORD, and PUBLIC_API_KEY usually indicate accidental secret exposure.',
    bad: {
      label: 'Secret-looking public env variable',
      code: `---
const apiKey = import.meta.env.PUBLIC_API_KEY
---
<p>{apiKey}</p>`
    },
    good: {
      label: 'Server-only secret',
      code: `---
const apiKey = import.meta.env.API_KEY
const publicUrl = import.meta.env.PUBLIC_API_URL
---
<p>{publicUrl}</p>`
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
  },
  {
    id: 'astro-doctor/no-blocking-script',
    name: 'no-blocking-script',
    slug: 'no-blocking-script',
    category: 'performance',
    severity: 'warn',
    description: 'Disallow render-blocking <script src="..."> tags — add defer, async, or type="module".',
    why: 'A <script src="..."> without defer, async, or type="module" blocks HTML parsing until the script downloads and executes. This delays the First Contentful Paint and Time to Interactive. Adding defer preserves execution order; async fires as soon as the script downloads; type="module" is always deferred.',
    bad: {
      label: 'Render-blocking script tag',
      code: `---
---
<html lang="en">
  <head>
    <script src="/analytics.js"></script>
  </head>
</html>`
    },
    good: {
      label: 'Non-blocking script with defer',
      code: `---
---
<html lang="en">
  <head>
    <!-- defer — preserves execution order, non-blocking -->
    <script src="/analytics.js" defer></script>
    <!-- async — fires as soon as downloaded, order not guaranteed -->
    <script src="/widget.js" async></script>
    <!-- type="module" is always deferred -->
    <script src="/app.js" type="module"></script>
  </head>
</html>`
    }
  },
  {
    id: 'astro-doctor/no-unprocessed-script-surprises',
    name: 'no-unprocessed-script-surprises',
    slug: 'no-unprocessed-script-surprises',
    category: 'performance',
    severity: 'warn',
    description: 'Warn when script attributes opt out of Astro script processing.',
    why: 'Astro bundles, deduplicates, TypeScript-processes, and may inline scripts with no attributes other than src. Unexpected attributes such as type, defer, async, or data-* opt out of that pipeline. Explicit is:inline scripts and JSON-LD data scripts are accepted because their processing opt-out is intentional.',
    bad: {
      label: 'Accidentally unprocessed script',
      code: `---
---
<script type="module">
  console.log('This is not processed by Astro')
</script>`
    },
    good: {
      label: 'Processed or explicitly inline script',
      code: `---
---
<script>
  console.log('Bundled, deduped, and processed by Astro')
</script>

<script is:inline>
  document.documentElement.dataset.theme = 'dark'
</script>`
    }
  },
  {
    id: 'astro-doctor/no-missing-lang',
    name: 'no-missing-lang',
    slug: 'no-missing-lang',
    category: 'accessibility',
    severity: 'error',
    description: 'Require a lang attribute on the <html> element.',
    why: 'Screen readers and search engines use the lang attribute to determine page language and apply the correct pronunciation rules or translation hints. A missing lang attribute is a WCAG 2.1 Level A failure (Success Criterion 3.1.1).',
    bad: {
      label: 'Missing lang attribute',
      code: `---
---
<html>
  <head><title>My Astro Site</title></head>
  <body>...</body>
</html>`
    },
    good: {
      label: 'lang attribute set',
      code: `---
---
<html lang="en">
  <head><title>My Astro Site</title></head>
  <body>...</body>
</html>`
    }
  },
  {
    id: 'astro-doctor/require-island-fallback',
    name: 'require-island-fallback',
    slug: 'require-island-fallback',
    category: 'accessibility',
    severity: 'warn',
    description: 'Require fallback content for client-only and deferred server islands.',
    why: 'client:only skips server rendering, and server:defer renders later on demand. Fallback content gives users immediate context instead of leaving an empty region while the island loads.',
    bad: {
      label: 'Island with no fallback',
      code: `---
import Chart from '../components/Chart.tsx'
---
<Chart client:only="react" />`
    },
    good: {
      label: 'Island with fallback content',
      code: `---
import Chart from '../components/Chart.tsx'
---
<Chart client:only="react">
  <div slot="fallback">Loading chart...</div>
</Chart>`
    }
  },
  {
    id: 'astro-doctor/no-process-env',
    name: 'no-process-env',
    slug: 'no-process-env',
    category: 'best-practices',
    severity: 'warn',
    description: 'Disallow process.env in Astro files — use import.meta.env instead.',
    why: 'process.env is a Node.js-specific API that does not work in client-side contexts. import.meta.env is Astro\'s standard for environment variables: it works in both server and client code, respects the PUBLIC_ prefix for client-safe exposure, and is type-safe with the Astro env schema.',
    bad: {
      label: 'Using process.env',
      code: `---
const apiKey = process.env.API_KEY
const publicUrl = process.env.PUBLIC_SITE_URL
---
<p>{publicUrl}</p>`
    },
    good: {
      label: 'Using import.meta.env',
      code: `---
const apiKey = import.meta.env.API_KEY
const publicUrl = import.meta.env.PUBLIC_SITE_URL
---
<p>{publicUrl}</p>`
    }
  },
  {
    id: 'astro-doctor/prefer-content-collections',
    name: 'prefer-content-collections',
    slug: 'prefer-content-collections',
    category: 'best-practices',
    severity: 'warn',
    description: 'Prefer Content Collections over Astro.glob() or import.meta.glob() for Markdown and MDX files.',
    why: 'Astro.glob() and import.meta.glob() return untyped content objects. Content Collections provide TypeScript types via the schema you define, build-time validation that catches typos and missing fields before deploy, and caching for better performance. They are the recommended approach for structured content.',
    bad: {
      label: 'Using Astro.glob()',
      code: `---
// No types, no validation, runs every request
const posts = await Astro.glob('../content/blog/*.md')
---
<ul>
  {posts.map(post => (
    <li>{post.frontmatter.title}</li>
  ))}
</ul>`
    },
    good: {
      label: 'Using Content Collections',
      code: `---
import { getCollection } from 'astro:content'

// Typed, validated at build time, cached
const posts = await getCollection('blog', ({ data }) => !data.draft)
---
<ul>
  {posts.map(post => (
    <li>{post.data.title}</li>
  ))}
</ul>`
    }
  }
]

export const PROJECT_AUDIT_RULES: readonly ProjectAuditRule[] = [
  {
    id: 'astro-doctor/no-disabled-origin-check',
    name: 'no-disabled-origin-check',
    slug: 'no-disabled-origin-check',
    category: 'security',
    severity: 'warn',
    preset: 'recommended',
    description: 'Keep Astro\'s built-in CSRF origin check enabled.',
    why: 'Astro checks the Origin header for on-demand rendered pages to help prevent cross-site request forgery. Setting security.checkOrigin to false removes that protection from form submissions and other state-changing requests unless the application supplies an equivalent defense.',
    bad: {
      label: 'Origin checking disabled',
      language: 'typescript',
      code: `import { defineConfig } from 'astro/config'

export default defineConfig({
  security: {
    checkOrigin: false,
  },
})`
    },
    good: {
      label: 'Use Astro\'s secure default',
      language: 'typescript',
      code: `import { defineConfig } from 'astro/config'

export default defineConfig({
  security: {
    checkOrigin: true,
  },
})`
    }
  },
  {
    id: 'astro-doctor/no-insecure-session-cookie',
    name: 'no-insecure-session-cookie',
    slug: 'no-insecure-session-cookie',
    category: 'security',
    severity: 'warn',
    preset: 'recommended',
    description: 'Keep secure, HTTP-only, same-site session cookie protections enabled.',
    why: 'Astro session cookies are secure, HTTP-only, and same-site by default. Explicitly disabling those properties can expose a session identifier to client-side scripts, insecure transport, or cross-site requests.',
    bad: {
      label: 'Session cookie protections disabled',
      language: 'typescript',
      code: `export default defineConfig({
  session: {
    cookie: {
      secure: false,
      httpOnly: false,
      sameSite: false,
    },
  },
})`
    },
    good: {
      label: 'Keep the secure defaults',
      language: 'typescript',
      code: `export default defineConfig({
  session: {
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    },
  },
})`
    }
  },
  {
    id: 'astro-doctor/no-open-allowed-domains',
    name: 'no-open-allowed-domains',
    slug: 'no-open-allowed-domains',
    category: 'security',
    severity: 'warn',
    preset: 'recommended',
    description: 'Configure explicit trusted host patterns instead of allowing every domain.',
    why: 'An empty allowed-domain pattern matches every host and defeats the protection that security.allowedDomains is intended to provide. List the exact hostnames or constrained wildcard patterns that should be trusted.',
    bad: {
      label: 'Every domain is allowed',
      language: 'typescript',
      code: `export default defineConfig({
  security: {
    allowedDomains: [{}],
  },
})`
    },
    good: {
      label: 'Allow an explicit trusted hostname',
      language: 'typescript',
      code: `export default defineConfig({
  security: {
    allowedDomains: [
      { hostname: 'www.example.com', protocol: 'https' },
    ],
  },
})`
    }
  },
  {
    id: 'astro-doctor/prefer-env-schema',
    name: 'prefer-env-schema',
    slug: 'prefer-env-schema',
    category: 'best-practices',
    severity: 'warn',
    preset: 'recommended',
    description: 'Define an Astro env schema for variables documented in .env.example.',
    why: 'An env schema validates required variables at startup and generates TypeScript types for server and client imports. Without one, documented variables can be missing, malformed, or used under the wrong name without an early error.',
    bad: {
      label: 'Documented variables without a schema',
      language: 'text',
      code: `# .env.example
DATABASE_URL=
PUBLIC_API_URL=`
    },
    good: {
      label: 'Validate documented variables in astro.config.ts',
      language: 'typescript',
      code: `import { defineConfig, envField } from 'astro/config'

export default defineConfig({
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public' }),
    },
  },
})`
    }
  },
  {
    id: 'astro-doctor/prefer-pnpm',
    name: 'prefer-pnpm',
    slug: 'prefer-pnpm',
    category: 'best-practices',
    severity: 'warn',
    preset: 'opt-in',
    description: 'Use pnpm consistently and remove competing package-manager lockfiles.',
    why: 'Declaring pnpm in packageManager makes local development and CI use the same package-manager version. Keeping npm, Yarn, or Bun lockfiles alongside pnpm-lock.yaml can produce different dependency graphs and non-reproducible installs.',
    bad: {
      label: 'Package manager is unspecified or competing lockfiles exist',
      language: 'json',
      code: `{
  "name": "my-astro-project"
}

# package-lock.json also exists`
    },
    good: {
      label: 'Declare pnpm and keep only its lockfile',
      language: 'json',
      code: `{
  "name": "my-astro-project",
  "packageManager": "pnpm@10.34.3"
}

# pnpm-lock.yaml`
    }
  },
  {
    id: 'astro-doctor/require-action-input-schema',
    name: 'require-action-input-schema',
    slug: 'require-action-input-schema',
    category: 'security',
    severity: 'warn',
    preset: 'recommended',
    description: 'Validate untrusted Astro Action input before the handler runs.',
    why: 'Astro Actions are public endpoints. An input schema rejects malformed or unexpected request data before it reaches application logic and gives the handler typed input.',
    bad: {
      label: 'Handler consumes input without validation',
      language: 'typescript',
      code: `export const server = {
  createUser: defineAction({
    handler: async (input) => createUser(input),
  }),
}`
    },
    good: {
      label: 'Validate input with a schema',
      language: 'typescript',
      code: `import { z } from 'astro:schema'

export const server = {
  createUser: defineAction({
    input: z.object({
      email: z.string().email(),
    }),
    handler: async ({ email }) => createUser({ email }),
  }),
}`
    }
  },
  {
    id: 'astro-doctor/require-client-router-script-lifecycle',
    name: 'require-client-router-script-lifecycle',
    slug: 'require-client-router-script-lifecycle',
    category: 'best-practices',
    severity: 'warn',
    preset: 'strict',
    description: 'Initialize scripts on astro:page-load when using ClientRouter.',
    why: 'ClientRouter navigation swaps page content without reloading the document, so DOMContentLoaded only initializes the first page. Astro emits astro:page-load after the initial load and every client-side navigation.',
    bad: {
      label: 'Only initializes after the first document load',
      code: `<script>
  document.addEventListener('DOMContentLoaded', initialize)
</script>`
    },
    good: {
      label: 'Initializes after every routed page load',
      code: `<script>
  document.addEventListener('astro:page-load', initialize)
</script>`
    }
  },
  {
    id: 'astro-doctor/require-content-config',
    name: 'require-content-config',
    slug: 'require-content-config',
    category: 'best-practices',
    severity: 'warn',
    preset: 'recommended',
    description: 'Add a content config when src/content contains entries.',
    why: 'A content config defines collections and their schemas so Astro can type and validate content entries. Content files without defineCollection() lose those guarantees and allow invalid frontmatter to reach a build or production page.',
    bad: {
      label: 'Content entries exist without src/content.config.ts',
      language: 'text',
      code: `src/
  content/
    blog/
      first-post.md`
    },
    good: {
      label: 'Define and export the collection',
      language: 'typescript',
      code: `import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
  }),
})

export const collections = { blog }`
    }
  }
]

export const ALL_RULES: readonly Rule[] = [...RULES, ...PROJECT_AUDIT_RULES]

export const RULE_BY_SLUG = Object.fromEntries(ALL_RULES.map(rule => [rule.slug, rule]))

const publicSecretEnvRule = RULES.find(rule => rule.id === 'astro-doctor/no-public-secret-env')
const projectAudits: ProjectAuditRule[] = [...PROJECT_AUDIT_RULES]

if (publicSecretEnvRule !== undefined) {
  projectAudits.push({
    ...publicSecretEnvRule,
    preset: 'recommended'
  })
}

export const PROJECT_AUDITS: readonly ProjectAuditRule[] = projectAudits

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  security: 'Security',
  'best-practices': 'Best Practices',
  architecture: 'Architecture'
}

export const CATEGORY_COLORS: Record<RuleCategory, string> = {
  performance: 'badge-performance',
  accessibility: 'badge-accessibility',
  security: 'badge-security',
  'best-practices': 'badge-best-practices',
  architecture: 'badge-architecture'
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  error: 'badge-error',
  warn: 'badge-warning'
}
