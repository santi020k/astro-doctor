import type { LumenIconName } from '@santi020k/lumen-core'

interface HomeFeature {
  readonly title: string
  readonly description: string
  readonly icon: LumenIconName
  readonly href: string
}

interface HomeGrade {
  readonly label: string
  readonly range: string
  readonly description: string
  readonly tone: string
}

export const HOME_FEATURES: readonly HomeFeature[] = [
  { title: 'In your terminal', description: 'Scan a project, inspect the findings, and export JSON or SARIF reports.', icon: 'terminal', href: '/docs/cli' },
  { title: 'In your editor', description: 'See diagnostics beside the code, with explanations and safe quick fixes.', icon: 'code', href: '/docs/editor-integration' },
  { title: 'In your pull request', description: 'Catch newly introduced issues with a summary that stays up to date.', icon: 'git-pull-request', href: '/docs/github-action' },
  { title: 'With your coding agent', description: 'Install practical Astro guidance so the next generation starts stronger.', icon: 'sparkles', href: '/docs/agent-skills' }
]

export const HOME_GRADES: readonly HomeGrade[] = [
  { label: 'S', range: '100', description: 'Zero diagnostics', tone: 'grade-s' },
  { label: 'A', range: '90–99', description: 'Excellent', tone: 'grade-a' },
  { label: 'B', range: '75–89', description: 'Good', tone: 'grade-b' },
  { label: 'C', range: '60–74', description: 'Fair', tone: 'grade-c' },
  { label: 'D', range: '40–59', description: 'Needs attention', tone: 'grade-d' },
  { label: 'F', range: '0–39', description: 'Critical', tone: 'grade-f' }
]

export const HOME_RULE_SLUGS: readonly string[] = [
  'no-client-load-overuse', 'no-missing-alt', 'no-set-html', 'prefer-content-collections'
]
