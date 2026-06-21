# Astro Doctor

Your agent writes bad Astro. This catches it.

## What This Skill Does

Astro Doctor scans your codebase and reports issues across five categories:
- **Performance** — client directive overuse, unoptimized images
- **Accessibility** — missing alt text on images
- **Security** — unsafe `set:html` usage
- **Best Practices** — dynamic class patterns, Astro idioms

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

## Running Astro Doctor

```bash
# One-time scan
npx astro-doctor@latest

# Scan a specific directory
npx astro-doctor@latest --dir ./src

# Install the agent skill (once you have a scan)
npx astro-doctor@latest install
```

## Using in CI (GitHub Actions)

```yaml
- uses: santi020k/astro-doctor@v1
```

## Configuration

Create `astro-doctor.config.ts` in your project root:

```ts
import type { AstroDoctorConfig } from 'astro-doctor/api'

export default {
  rules: {
    'astro-doctor/no-client-load-overuse': 'error', // promote to error
    'astro-doctor/no-set-html': 'off',               // disable if you sanitize elsewhere
  },
} satisfies AstroDoctorConfig
```
