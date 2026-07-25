import { ALL_RULES } from './rules'

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
      { label: 'ESLint Plugin', href: '/docs/eslint-plugin' },
      { label: 'CLI', href: '/docs/cli' },
      { label: 'GitHub Action', href: '/docs/github-action' },
      { label: 'VS Code Extension', href: '/docs/vscode-extension' },
      { label: 'Editor Integration', href: '/docs/editor-integration', badge: 'LSP' },
      { label: 'Agent Skills', href: '/docs/agent-skills', badge: 'AI' }
    ]
  },
  {
    title: 'Rules',
    items: [
      { label: 'Overview', href: '/docs/rules' },
      ...ALL_RULES.map(rule => ({
        label: rule.name,
        href: `/docs/rules/${rule.slug}`
      }))
    ]
  }
]
