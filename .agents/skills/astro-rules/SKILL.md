# Astro Doctor — Rules Reference

> Astro Doctor scans `.astro` files for issues across performance, accessibility, security, and best practices.
> Inspired by [react-doctor](https://github.com/millionco/react-doctor) by Million Software, Inc.

## When to apply this skill

Load this skill when:
- You are about to write or modify a `.astro` component
- A PR review mentions an Astro Doctor finding
- You need to explain or fix a `astro-doctor/` ESLint warning

## Rules

### `astro-doctor/no-client-load-overuse` — performance, warning

`client:load` hydrates immediately on page load — blocks TTI. Most components should defer.

| Directive | When it hydrates | Use for |
|-----------|-----------------|---------|
| `client:load` | Immediately | Only critical above-the-fold interactive UI |
| `client:idle` | After browser is idle | Non-critical UI, footers, sidebars |
| `client:visible` | On viewport entry | Below-the-fold content, carousels |
| `client:media="(query)"` | When media query matches | Responsive-only components |

```astro
<!-- ❌ Hydrates immediately -->
<Counter client:load />

<!-- ✅ Hydrates after initial load — almost always better -->
<Counter client:idle />

<!-- ✅ Hydrates when scrolled into view -->
<NewsletterSignup client:visible />
```

### `astro-doctor/use-astro-image` — performance, warning

Raw `<img>` bypasses Astro's image optimization. Use `<Image>` or `<Picture>` from `astro:assets`.

Benefits: automatic WebP/AVIF conversion, responsive `srcset`, build-time dimension extraction (prevents layout shift), enforced `alt`.

```astro
---
// ❌ No optimization, no srcset, no format conversion
---
<img src="/hero.jpg" alt="Hero" />

---
import { Image } from 'astro:assets'
import heroImage from '../assets/hero.jpg'
---
<!-- ✅ Optimized at build time -->
<Image src={heroImage} alt="Hero" />
```

### `astro-doctor/no-missing-alt` — accessibility, error

All `<img>`, `<Image>`, and `<Picture>` elements must have `alt`.

- Descriptive images → meaningful text
- Decorative images → `alt=""` (empty string, not omitted) + `role="presentation"`

```astro
<!-- ❌ Missing alt — screen readers skip or announce URL -->
<img src="/logo.png" />

<!-- ✅ -->
<img src="/hero.jpg" alt="Mountain landscape at sunset" />
<img src="/divider.svg" alt="" role="presentation" />
```

### `astro-doctor/no-set-html` — security, warning

`set:html` injects raw HTML — XSS risk when the value comes from user input.

```astro
---
const userContent = await getUserPost()
---

<!-- ❌ XSS risk -->
<div set:html={userContent} />

<!-- ✅ Escape: Astro escapes JSX expressions by default -->
<div>{userContent}</div>

<!-- ✅ If you must inject HTML, sanitize first -->
import DOMPurify from 'isomorphic-dompurify'
<div set:html={DOMPurify.sanitize(userContent)} />
```

### `astro-doctor/prefer-class-list` — best-practices, warning

Template literals for class names are hard to read and easy to break. Use `class:list`.

```astro
---
const isActive = true
const variant = 'primary'
---

<!-- ❌ Template literal — trailing space bugs, hard to extend -->
<button class={`btn btn-${variant} ${isActive ? 'active' : ''}`}>Click</button>

<!-- ✅ class:list — idiomatic Astro, supports objects and arrays -->
<button class:list={['btn', `btn-${variant}`, { active: isActive }]}>Click</button>
```

### `astro-doctor/no-blocking-script` — performance, warning

`<script src="...">` without `defer`, `async`, or `type="module"` blocks HTML parsing and delays First Contentful Paint.

| Strategy | Behavior | Best for |
|----------|----------|----------|
| `defer` | Downloads async, executes in order after parse | Scripts that depend on each other |
| `async` | Downloads async, executes immediately on load | Independent scripts (analytics) |
| `type="module"` | Always deferred, supports ESM imports | Modern bundled code |

```astro
<!-- ❌ Blocks HTML parsing until downloaded + executed -->
<script src="/analytics.js"></script>

<!-- ✅ Deferred — preserves execution order -->
<script src="/analytics.js" defer></script>

<!-- ✅ Async — fires as soon as downloaded -->
<script src="/widget.js" async></script>

<!-- ✅ ES module — always deferred -->
<script src="/app.js" type="module"></script>
```

### `astro-doctor/no-missing-lang` — accessibility, error

All `<html>` elements must have a `lang` attribute. Screen readers and search engines use it to determine page language. Missing `lang` is a WCAG 2.1 Level A failure (SC 3.1.1).

```astro
<!-- ❌ Missing lang — screen readers may mispronounce content -->
<html>
  <head><title>My Site</title></head>
  <body>...</body>
</html>

<!-- ✅ Explicit lang -->
<html lang="en">
  <head><title>My Site</title></head>
  <body>...</body>
</html>

<!-- ✅ Dynamic lang (i18n) -->
<html lang={Astro.currentLocale ?? 'en'}>
  ...
</html>
```

### `astro-doctor/no-process-env` — best-practices, warning

`process.env` is Node.js-only and doesn't work in client code or respect Astro's `PUBLIC_` prefix rules. Use `import.meta.env` everywhere.

```astro
---
// ❌ Doesn't work in client context, no PUBLIC_ support
const apiKey = process.env.API_KEY
const siteUrl = process.env.PUBLIC_SITE_URL
---

---
// ✅ Works server and client, respects PUBLIC_ visibility
const apiKey = import.meta.env.API_KEY
const siteUrl = import.meta.env.PUBLIC_SITE_URL
---
```

### `astro-doctor/prefer-content-collections` — best-practices, warning

`Astro.glob()` returns untyped frontmatter objects and runs at request time. Use `getCollection()` from `astro:content` for typed, build-time-validated, cached content.

```astro
---
// ❌ No types, no build-time validation, no caching
const posts = await Astro.glob('../content/blog/*.md')
---
<ul>{posts.map(p => <li>{p.frontmatter.title}</li>)}</ul>

---
// ✅ Typed via schema, validated at build, cached
import { getCollection } from 'astro:content'
const posts = await getCollection('blog', ({ data }) => !data.draft)
---
<ul>{posts.map(p => <li>{p.data.title}</li>)}</ul>
```

Note: `import.meta.glob()` for non-content assets (images, JSON, etc.) is fine and not flagged.

## Configuration

Create `doctor.config.ts` in your project root to override severities:

```ts
import type { AstroDoctorConfig } from '@santi020k/astro-doctor'

export default {
  rules: {
    'astro-doctor/no-client-load-overuse': 'error',  // promote to error
    'astro-doctor/no-set-html': 'off',                // disable if you sanitize globally
  },
} satisfies AstroDoctorConfig
```

Also supports: `doctor.config.js`, `.mjs`, `.cjs`, `.json`, `.jsonc`

## Running

```bash
npx @santi020k/astro-doctor@latest            # scan current directory
npx @santi020k/astro-doctor@latest --dir src  # scan ./src
npx @santi020k/astro-doctor@latest --json     # JSON output to stdout
npx @santi020k/astro-doctor@latest install    # install agent skills
```
