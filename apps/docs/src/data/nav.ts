export interface NavItem {
  readonly label: string
  readonly href: string
  readonly badge?: string
}

export interface NavSection {
  readonly title: string
  readonly items: readonly NavItem[]
}

export const DOCS_NAV: readonly NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Introduction', href: '/docs' },
      { label: 'Installation', href: '/docs/installation' },
      { label: 'Quick Start', href: '/docs/quick-start' },
      { label: 'Configuration', href: '/docs/configuration' }
    ]
  },
  {
    title: 'Reference',
    items: [
      { label: 'CLI', href: '/docs/cli' },
      { label: 'GitHub Action', href: '/docs/github-action' },
      { label: 'Editor Integration', href: '/docs/editor-integration', badge: 'LSP' },
      { label: 'Agent Skills', href: '/docs/agent-skills', badge: 'AI' }
    ]
  },
  {
    title: 'Rules',
    items: [
      { label: 'Overview', href: '/docs/rules' },
      { label: 'no-client-load-overuse', href: '/docs/rules/no-client-load-overuse' },
      { label: 'use-astro-image', href: '/docs/rules/use-astro-image' },
      { label: 'no-blocking-script', href: '/docs/rules/no-blocking-script' },
      { label: 'no-missing-alt', href: '/docs/rules/no-missing-alt' },
      { label: 'no-missing-lang', href: '/docs/rules/no-missing-lang' },
      { label: 'no-set-html', href: '/docs/rules/no-set-html' },
      { label: 'prefer-class-list', href: '/docs/rules/prefer-class-list' },
      { label: 'no-process-env', href: '/docs/rules/no-process-env' },
      { label: 'prefer-content-collections', href: '/docs/rules/prefer-content-collections' }
    ]
  }
]
