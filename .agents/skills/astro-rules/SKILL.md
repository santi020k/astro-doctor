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
