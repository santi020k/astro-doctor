# Astro Islands Performance Patterns

This skill covers Astro-specific performance patterns beyond what the linter catches.
Apply it when writing or reviewing `.astro` components in performance-sensitive contexts.

## Islands Architecture — Core Principle

Astro renders everything to static HTML by default. JavaScript is only sent for components that explicitly opt in with a `client:*` directive. Every `client:*` adds JS to the bundle and delays Time to Interactive (TTI).

**Rule of thumb:** If it doesn't need to react to user events, don't hydrate it.

## Choosing the Right `client:*` Directive

| Situation | Correct directive |
|-----------|-----------------|
| Above-the-fold, immediately interactive (search bar, cart counter) | `client:load` |
| Non-critical interactive (newsletter form, cookie banner) | `client:idle` |
| Below the fold (comment section, related products carousel) | `client:visible` |
| Only needed on certain screen sizes | `client:media="(min-width: 768px)"` |
| Controlled hydration from JS | `client:only="react"` (no SSR) |

```astro
<!-- ❌ Everything on client:load = no islands benefit -->
<Header client:load />
<HeroSlider client:load />
<NewsletterForm client:load />
<Footer client:load />

<!-- ✅ Only hydrate what users immediately interact with -->
<Header client:load />          <!-- navigation, always interactive -->
<HeroSlider client:idle />      <!-- visual, can wait -->
<NewsletterForm client:visible />  <!-- below fold -->
<!-- Footer needs no JS at all — just leave it static -->
<Footer />
```

## Image Optimization Checklist

When using `<Image>` from `astro:assets`:

1. **Import local images** — enables build-time dimension extraction and format conversion
2. **Remote images** — add the domain to `image.domains` in `astro.config.*`
3. **Width/height** — always provide for remote images to prevent layout shift
4. **Format** — Astro outputs WebP by default; use `format="avif"` for even better compression on modern browsers
5. **Loading strategy** — `loading="lazy"` for below-fold, `loading="eager"` + `fetchpriority="high"` for the LCP image

```astro
---
import { Image } from 'astro:assets'
import heroImage from '../assets/hero.jpg'
---

<!-- ✅ LCP image — eager + high priority -->
<Image
  src={heroImage}
  alt="Product hero"
  loading="eager"
  fetchpriority="high"
/>

<!-- ✅ Below-fold image — lazy -->
<Image
  src={heroImage}
  alt="Related product"
  loading="lazy"
  width={400}
  height={300}
/>
```

## External Scripts — Defer or Async

A `<script src="...">` without `defer`, `async`, or `type="module"` blocks HTML parsing and delays FCP. The browser stops parsing until the script is downloaded and executed.

```astro
<!-- ❌ Blocks HTML parsing on every page load -->
<script src="/analytics.js"></script>

<!-- ✅ defer — preserves order, non-blocking -->
<script src="/analytics.js" defer></script>

<!-- ✅ async — fires as soon as downloaded (order not guaranteed) -->
<script src="/widget.js" async></script>

<!-- ✅ type="module" — always deferred, scoped, strict -->
<script src="/app.js" type="module"></script>
```

Use `defer` for scripts that depend on the DOM. Use `async` only for truly independent scripts (analytics, ads). Inline Astro `<script>` tags are automatically bundled and module-scoped — no attribute needed.

## Content Collections vs. Direct Imports

Use `getCollection()` / `getEntry()` over direct `import` for large sets of content — Astro's Content Collections are type-safe, cached, and paginated.

```ts
// ❌ Direct glob — no types, no caching
const posts = await Astro.glob('../content/blog/*.md')

// ✅ Content Collections — typed, cached, filterable
import { getCollection } from 'astro:content'
const posts = await getCollection('blog', ({ data }) => !data.draft)
```

## View Transitions

Use the `<ViewTransition />` component for client-side navigation feel without a full SPA.
Keep the `transition:name` scope narrow — only on the element that visually persists, not a wrapper.

```astro
---
import { ViewTransitions } from 'astro:transitions'
---
<head>
  <ViewTransitions />
</head>

<!-- ✅ Scoped to the persisting element -->
<img src={post.image} alt={post.title} transition:name={`post-image-${post.slug}`} />
```

## Server Islands (Astro 4.12+)

For sections that need live data (cart count, personalized greeting) without shipping JS to the client, use `server:defer`:

```astro
---
import CartCount from '../components/CartCount.astro'
---

<!-- Renders a placeholder, then streams in the personalized content -->
<CartCount server:defer>
  <span slot="fallback">0</span>
</CartCount>
```

This avoids client hydration entirely — the server fills in the dynamic part after the static shell is sent.
