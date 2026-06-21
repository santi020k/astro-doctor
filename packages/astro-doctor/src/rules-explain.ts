import astroDoctorPlugin from '@santi020k/eslint-plugin-astro-doctor'

const RULE_DETAILS: Record<string, {
  category: string
  severity: string
  why: string
  bad: string
  good: string
  docs?: string
}> = {
  'no-blocking-script': {
    category: 'performance',
    severity: 'error',
    why: 'A <script src="..."> without defer, async, or type="module" blocks the HTML parser. The browser stops building the DOM until the script is downloaded, parsed, and executed — directly harming Time to Interactive.',
    bad: '<script src="/analytics.js"></script>',
    good: '<script src="/analytics.js" defer></script>\n<!-- or -->\n<script src="/analytics.js" type="module"></script>',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#defer',
  },
  'no-client-load-overuse': {
    category: 'performance',
    severity: 'warning',
    why: 'client:load hydrates every matching component immediately at page load, sending JavaScript to the browser even for components the user may never interact with. Overuse defeats Astro\'s islands architecture.',
    bad: '<HeavyWidget client:load />\n<Sidebar client:load />\n<Footer client:load />',
    good: '<HeavyWidget client:idle />\n<Sidebar client:visible />\n<!-- Only truly critical UI should use client:load -->',
    docs: 'https://docs.astro.build/en/reference/directives-reference/#client-directives',
  },
  'use-astro-image': {
    category: 'performance',
    severity: 'warning',
    why: 'Raw <img> tags bypass Astro\'s image optimization. astro:assets generates modern formats (WebP/AVIF), compresses images, infers dimensions to prevent layout shift, and lazy-loads by default.',
    bad: '<img src="/hero.png" alt="Hero" />',
    good: 'import heroImage from \'../assets/hero.png\'\n---\n<Image src={heroImage} alt="Hero" />',
    docs: 'https://docs.astro.build/en/guides/images/',
  },
  'no-missing-alt': {
    category: 'accessibility',
    severity: 'error',
    why: 'Images without alt text are invisible to screen readers. This violates WCAG 2.1 Success Criterion 1.1.1 (Level A) and breaks accessibility for blind users. Search engines also rely on alt text to understand image content.',
    bad: '<img src="/logo.png" />',
    good: '<img src="/logo.png" alt="Company logo" />\n<!-- Decorative images: -->\n<img src="/divider.png" alt="" role="presentation" />',
    docs: 'https://www.w3.org/WAI/tutorials/images/',
  },
  'no-missing-lang': {
    category: 'accessibility',
    severity: 'error',
    why: 'Without a lang attribute on <html>, screen readers pick a language at random, often reading content in the wrong accent or voice. It also confuses browser translation features and search engine language detection.',
    bad: '<html>\n  <head>...</head>\n</html>',
    good: '<html lang="en">\n  <head>...</head>\n</html>',
    docs: 'https://www.w3.org/International/questions/qa-html-language-declarations',
  },
  'no-set-html': {
    category: 'security',
    severity: 'error',
    why: 'set:html injects raw HTML without escaping. If any part of that HTML comes from user input or an external API, it becomes a Cross-Site Scripting (XSS) vector. Attackers can steal session tokens, redirect users, or execute arbitrary code.',
    bad: '<div set:html={userProvidedContent} />',
    good: '<!-- Option 1: Sanitize with DOMPurify before use -->\n<div set:html={DOMPurify.sanitize(userContent)} />\n<!-- Option 2: Render as text instead -->\n<div>{userContent}</div>',
    docs: 'https://docs.astro.build/en/reference/directives-reference/#sethtml',
  },
  'no-process-env': {
    category: 'best-practices',
    severity: 'warning',
    why: 'process.env is a Node.js-only API. In Astro, components may run in edge runtimes, Deno, or client-side contexts where process is undefined. It also bypasses Astro\'s type-safe env validation.',
    bad: 'const apiKey = process.env.MY_API_KEY',
    good: 'const apiKey = import.meta.env.MY_API_KEY\n// Or with the env schema in astro.config.*:  \nimport { MY_API_KEY } from "astro:env/server"',
    docs: 'https://docs.astro.build/en/guides/environment-variables/',
  },
  'prefer-class-list': {
    category: 'best-practices',
    severity: 'warning',
    why: 'String concatenation for class names is fragile — extra spaces, missing conditionals, and undefined values cause bugs. class:list handles arrays, objects, and conditional class names cleanly and is the Astro idiom.',
    bad: '<div class={`btn ${isActive ? "active" : ""} ${variant}`} />',
    good: '<div class:list={["btn", { active: isActive }, variant]} />',
    docs: 'https://docs.astro.build/en/reference/directives-reference/#classlist',
  },
  'prefer-content-collections': {
    category: 'best-practices',
    severity: 'warning',
    why: 'Astro.glob() returns untyped data and re-reads the filesystem on every page render. Content Collections are fully type-safe (with Zod schemas), validated at build time, and significantly faster.',
    bad: 'const posts = await Astro.glob("../content/posts/*.md")',
    good: 'import { getCollection } from "astro:content"\nconst posts = await getCollection("posts")',
    docs: 'https://docs.astro.build/en/guides/content-collections/',
  },
}

const listAllRules = (): void => {
  console.log('\nAstro Doctor rules:\n')

  const byCategory = new Map<string, string[]>()

  for (const [ruleId, detail] of Object.entries(RULE_DETAILS)) {
    const existing = byCategory.get(detail.category) ?? []

    existing.push(ruleId)

    byCategory.set(detail.category, existing)
  }

  for (const [category, ruleIds] of byCategory) {
    console.log(`  ${category}`)

    for (const ruleId of ruleIds) {
      const detail = RULE_DETAILS[ruleId]!
      const severity = detail.severity === 'error' ? 'error  ' : 'warning'

      console.log(`    ${severity}  astro-doctor/${ruleId}`)
    }

    console.log('')
  }

  console.log('Run: astro-doctor rules explain <rule-id>\n')
}

const explainRule = (ruleId: string): void => {
  // Accept with or without the plugin prefix
  const short = ruleId.replace(/^astro-doctor\//u, '')
  const detail = RULE_DETAILS[short]
  const pluginRule = astroDoctorPlugin.rules[short]

  if (!detail || !pluginRule) {
    console.error(`\nUnknown rule: "${ruleId}"\n`)

    listAllRules()

    process.exitCode = 1

    return
  }

  const fullId = `astro-doctor/${short}`

  console.log(`\n${fullId}\n${'─'.repeat(fullId.length + 2)}`)

  console.log(`Category: ${detail.category}  |  Default severity: ${detail.severity}`)

  console.log(`\n${pluginRule.meta?.docs?.description ?? detail.why}\n`)

  console.log(`Why this matters:\n  ${detail.why}\n`)

  console.log(`Bad:\n${detail.bad.split('\n').map((l) => `  ${l}`).join('\n')}\n`)

  console.log(`Good:\n${detail.good.split('\n').map((l) => `  ${l}`).join('\n')}\n`)

  if (detail.docs) {
    console.log(`Docs: ${detail.docs}\n`)
  }
}

export const runRulesExplain = (args: string[]): void => {
  // `astro-doctor rules` or `astro-doctor rules list` → list all
  if (args.length === 0 || args[0] === 'list') {
    listAllRules()

    return
  }

  if (args[0] === 'explain') {
    const ruleId = args[1]

    if (!ruleId) {
      console.error('\nUsage: astro-doctor rules explain <rule-id>\nExample: astro-doctor rules explain no-set-html\n')

      process.exitCode = 1

      return
    }

    explainRule(ruleId)

    return
  }

  // Unknown subcommand — treat as rule ID for convenience
  explainRule(args[0]!)
}
