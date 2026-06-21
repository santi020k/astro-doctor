# Astro Doctor

Your agent writes bad Astro. This catches it.

> Inspired by [react-doctor](https://github.com/millionco/react-doctor) by Million Software, Inc — the same concept, built for Astro.

## What This Skill Does

Astro Doctor scans your codebase and reports issues across four categories with 14 ESLint rules plus project-level audits:
- **Performance** — client directive overuse, unoptimized images, missing image dimensions, render-blocking scripts, unprocessed script opt-outs
- **Accessibility** — missing alt text, missing HTML lang attribute, missing island fallback content
- **Security** — unsafe `set:html` usage, public env vars that look like secrets
- **Best Practices** — dynamic class patterns, environment variable access, content management, package/config hygiene

## Rules

### Performance

#### `no-client-load-overuse`
**Severity: warning**

`client:load` hydrates a component immediately on page load — the most aggressive and expensive directive. Most components do not need to be interactive that early.

Prefer:
- `client:idle` — hydrates after the browser is idle (non-critical UI, footers, sidebars)
- `client:visible` — hydrates when the component enters the viewport (below-the-fold content, carousels)
- `client:media="(query)"` — hydrates only when a media query matches (responsive components)

```astro
<!-- ❌ Hydrates immediately, blocks TTI -->
<Counter client:load />

<!-- ✅ Hydrates after initial load -->
<Counter client:idle />

<!-- ✅ Hydrates on viewport entry -->
<NewsletterSignup client:visible />
```

#### `use-astro-image`
**Severity: warning**

Raw `<img>` elements bypass Astro's built-in image optimization pipeline. Use `<Image>` or `<Picture>` from `astro:assets` to get:
- Automatic format conversion (WebP / AVIF)
- Responsive `srcset` generation
- Build-time dimension extraction (prevents layout shift)
- Enforced `alt` attribute

```astro
---
// ❌ Raw img — no optimization
---
<img src="/hero.jpg" alt="Hero" />

---
// ✅ Astro Image — optimized at build time
import { Image } from 'astro:assets'
import heroImage from '../assets/hero.jpg'
---
<Image src={heroImage} alt="Hero" />
```

#### `no-blocking-script`
**Severity: warning**

`<script src="...">` without `defer`, `async`, or `type="module"` blocks HTML parsing and delays First Contentful Paint.

```astro
<!-- ❌ Blocks HTML parsing until downloaded + executed -->
<script src="/analytics.js"></script>

<!-- ✅ defer — preserves execution order, non-blocking -->
<script src="/analytics.js" defer></script>

<!-- ✅ async — fires as soon as downloaded -->
<script src="/widget.js" async></script>

<!-- ✅ type="module" — always deferred -->
<script src="/app.js" type="module"></script>
```

#### `no-unprocessed-script-surprises`
**Severity: warning**

Astro processes scripts with no attributes other than `src`. Adding attributes such as `type`, `defer`, `async`, `data-*`, or `is:inline` opts out of bundling, TypeScript processing, and deduplication.

```astro
<!-- ❌ Opts out of Astro processing -->
<script type="module">
  console.log('raw browser script')
</script>

<!-- ✅ Processed by Astro -->
<script>
  console.log('bundled and deduped')
</script>
```

#### `require-image-dimensions`
**Severity: warning**

Astro can infer dimensions for imported images from `src/`, but public and remote image strings need dimensions or `inferSize` to avoid layout shift.

```astro
---
import { Image } from 'astro:assets'
---

<!-- ❌ public image without dimensions -->
<Image src="/hero.png" alt="Hero" />

<!-- ✅ public image with dimensions -->
<Image src="/hero.png" alt="Hero" width="1200" height="630" />

<!-- ✅ remote image with inferred dimensions -->
<Image src="https://cdn.example.com/hero.png" alt="Hero" inferSize />
```

### Accessibility

#### `no-missing-alt`
**Severity: error**

All `<img>`, `<Image>`, and `<Picture>` elements must have an `alt` attribute.
- Descriptive images: use a meaningful description
- Decorative images: use `alt=""` with `role="presentation"`

```astro
<!-- ❌ Missing alt -->
<img src="/logo.png" />

<!-- ✅ Descriptive alt -->
<img src="/hero.jpg" alt="Mountain landscape at sunset" />

<!-- ✅ Decorative image -->
<img src="/divider.svg" alt="" role="presentation" />
```

#### `no-missing-lang`
**Severity: error**

The `<html>` element must have a `lang` attribute. Screen readers and search engines use it to determine page language. Missing `lang` is a WCAG 2.1 Level A failure (SC 3.1.1).

```astro
<!-- ❌ Missing lang — WCAG SC 3.1.1 failure -->
<html>
  <head><title>My Site</title></head>
  <body>...</body>
</html>

<!-- ✅ Always set lang -->
<html lang="en">
  ...
</html>
```

#### `require-island-fallback`
**Severity: warning**

`client:only` skips server rendering and `server:defer` renders later on demand. Provide fallback content so users do not see an empty region while the island loads.

```astro
---
import Chart from '../components/Chart.tsx'
---

<!-- ❌ Empty until the client component loads -->
<Chart client:only="react" />

<!-- ✅ Useful initial UI -->
<Chart client:only="react">
  <div slot="fallback">Loading chart...</div>
</Chart>
```

### Security

#### `no-set-html`
**Severity: warning**

`set:html` injects raw HTML into the DOM and is a potential XSS vector when the value comes from user input or external sources.

```astro
---
const userContent = await getUserPost() // ⚠️ untrusted
---

<!-- ❌ XSS risk if userContent contains <script> tags -->
<div set:html={userContent} />

<!-- ✅ Escaped output -->
<div>{userContent}</div>

<!-- ✅ If you must use set:html, sanitize first -->
import DOMPurify from 'isomorphic-dompurify'
<div set:html={DOMPurify.sanitize(userContent)} />
```

#### `no-public-secret-env`
**Severity: warning**

Variables prefixed with `PUBLIC_` are exposed to browser code. Names like `PUBLIC_TOKEN`, `PUBLIC_SECRET`, `PUBLIC_PASSWORD`, and `PUBLIC_API_KEY` usually indicate accidental secret exposure.

```astro
---
// ❌ Exposed to the client bundle
const apiKey = import.meta.env.PUBLIC_API_KEY
---

---
// ✅ Server-only secret, public non-secret URL
const apiKey = import.meta.env.API_KEY
const apiUrl = import.meta.env.PUBLIC_API_URL
---
```

### Best Practices

#### `prefer-class-list`
**Severity: warning**

Use `class:list` for dynamic class names instead of template literals or string concatenation. `class:list` supports arrays, objects (for conditionals), and nested lists.

```astro
---
const isActive = true
const variant = 'primary'
---

<!-- ❌ Template literal — hard to read, easy to get wrong -->
<button class={`btn btn-${variant} ${isActive ? 'active' : ''}`}>Click</button>

<!-- ✅ class:list — idiomatic Astro -->
<button class:list={['btn', `btn-${variant}`, { active: isActive }]}>Click</button>
```

#### `no-process-env`
**Severity: warning**

`process.env` is Node.js-only and doesn't work in client-side code or respect Astro's `PUBLIC_` prefix visibility rules. Use `import.meta.env` instead.

```astro
---
// ❌ Node.js-only — breaks in client context, no PUBLIC_ support
const apiKey = process.env.API_KEY
---

---
// ✅ Works server and client, respects PUBLIC_ visibility
const apiKey = import.meta.env.API_KEY
const siteUrl = import.meta.env.PUBLIC_SITE_URL
---
```

#### `prefer-content-collections`
**Severity: warning**

`Astro.glob()` and content-focused `import.meta.glob()` return untyped content objects. Content Collections provide TypeScript types, build-time validation, and caching.

```astro
---
// ❌ No types, no validation, no caching
const posts = await Astro.glob('../content/blog/*.md')
---

---
// ❌ Also untyped for structured content
const posts = import.meta.glob('../content/blog/*.md')
---

---
// ✅ Typed, validated at build time, cached
import { getCollection } from 'astro:content'
const posts = await getCollection('blog', ({ data }) => !data.draft)
---
```

## Running Astro Doctor

```bash
# One-time scan
pnpm dlx @santi020k/astro-doctor@latest

# Scan a specific directory
pnpm dlx @santi020k/astro-doctor@latest --dir ./src

# Install the agent skill (once you have a scan)
pnpm dlx @santi020k/astro-doctor@latest install
```

## Using in CI (GitHub Actions)

```yaml
- uses: santi020k/astro-doctor@v1
```

## Configuration

Create `doctor.config.ts` in your project root:

```ts
import type { AstroDoctorConfig } from '@santi020k/astro-doctor'

export default {
  preset: 'recommended',
  rules: {
    'astro-doctor/no-client-load-overuse': 'error', // promote to error
    'astro-doctor/no-set-html': 'off',               // disable if you sanitize elsewhere
  },
} satisfies AstroDoctorConfig
```

## Credits

Astro Doctor is inspired by **[react-doctor](https://github.com/millionco/react-doctor)** by Million Software, Inc.
The same diagnostic philosophy, the same agent skill pattern — brought to Astro.

ESLint configuration powered by [`@santi020k/eslint-config-basic`](https://github.com/santi020k/eslint-config-basic).
