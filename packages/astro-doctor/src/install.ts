import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const SKILLS_SOURCE_DIR = resolve(fileURLToPath(import.meta.url), '../../../..')

interface SkillTarget {
  readonly sourceFile: string
  readonly destDir: string
  readonly destFile: string
  readonly label: string
}

interface InstallOptions {
  readonly yes: boolean
  readonly dryRun: boolean
  readonly agentHooks: boolean
  readonly projectRoot: string
}

const SKILL_TARGETS: SkillTarget[] = [
  {
    sourceFile: resolve(SKILLS_SOURCE_DIR, 'skills/SKILL.md'),
    destDir: 'skills',
    destFile: 'astro-doctor.md',
    label: 'Astro Doctor rules (skills/astro-doctor.md)',
  },
]

// Agent hook directories that support a skills/ convention
const AGENT_HOOK_TARGETS: SkillTarget[] = [
  {
    sourceFile: resolve(SKILLS_SOURCE_DIR, 'skills/SKILL.md'),
    destDir: '.claude/skills',
    destFile: 'astro-doctor.md',
    label: 'Claude Code hook (.claude/skills/astro-doctor.md)',
  },
  {
    sourceFile: resolve(SKILLS_SOURCE_DIR, 'skills/SKILL.md'),
    destDir: '.cursor/rules',
    destFile: 'astro-doctor.mdc',
    label: 'Cursor rule (.cursor/rules/astro-doctor.mdc)',
  },
]

const GITHUB_ACTIONS_WORKFLOW = `name: Astro Doctor
on:
  pull_request:
    paths:
      - '**/*.astro'

jobs:
  astro-doctor:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: santi020k/astro-doctor@v1
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
`

const prompt = (question: string): Promise<string> =>
  new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })

    rl.question(question, (answer) => {
      rl.close()

      resolve(answer.trim().toLowerCase())
    })
  })

const confirm = async (question: string, yes: boolean): Promise<boolean> => {
  if (yes) return true

  const answer = await prompt(`${question} [y/N] `)

  return answer === 'y' || answer === 'yes'
}

const installTarget = (target: SkillTarget, projectRoot: string, dryRun: boolean): void => {
  const destDirectory = join(projectRoot, target.destDir)
  const destPath = join(destDirectory, target.destFile)

  if (dryRun) {
    console.log(`  [dry-run] Would install → ${destPath}`)

    return
  }

  if (!existsSync(destDirectory)) {
    mkdirSync(destDirectory, { recursive: true })
  }

  const content = readFileSync(target.sourceFile, 'utf8')

  writeFileSync(destPath, content, 'utf8')

  console.log(`  ✓ Installed ${target.label}`)
}

const installGitHubAction = (projectRoot: string, dryRun: boolean): void => {
  const workflowDir = join(projectRoot, '.github/workflows')
  const workflowPath = join(workflowDir, 'astro-doctor.yml')

  if (dryRun) {
    console.log(`  [dry-run] Would create → ${workflowPath}`)

    return
  }

  if (!existsSync(workflowDir)) {
    mkdirSync(workflowDir, { recursive: true })
  }

  if (existsSync(workflowPath)) {
    console.log(`  ✓ GitHub Actions workflow already exists (${workflowPath}) — skipping`)

    return
  }

  writeFileSync(workflowPath, GITHUB_ACTIONS_WORKFLOW, 'utf8')

  console.log(`  ✓ Created .github/workflows/astro-doctor.yml`)
}

const detectAgents = (projectRoot: string): string[] => {
  const detected: string[] = []

  if (existsSync(join(projectRoot, '.claude'))) detected.push('Claude Code')

  if (existsSync(join(projectRoot, '.cursor'))) detected.push('Cursor')

  if (existsSync(join(projectRoot, '.codeium'))) detected.push('Windsurf')

  if (existsSync(join(projectRoot, '.github/copilot-instructions.md'))) detected.push('GitHub Copilot')

  return detected
}

export const runInstall = async (
  argv: string[] = [],
  projectRoot = process.cwd(),
): Promise<void> => {
  const yes = argv.includes('-y') || argv.includes('--yes')
  const dryRun = argv.includes('--dry-run')
  const agentHooks = argv.includes('--agent-hooks')
  const options: InstallOptions = { yes, dryRun, agentHooks, projectRoot }

  console.log('\nAstro Doctor — Interactive Setup\n')

  if (dryRun) {
    console.log('  Running in dry-run mode — no files will be written.\n')
  }

  const packageJsonPath = join(projectRoot, 'package.json')

  if (!existsSync(packageJsonPath)) {
    console.warn('  ⚠ No package.json found — make sure you run this from your project root.\n')
  }

  // 1. GitHub Actions
  const addGitHubActions = await confirm(
    'Add GitHub Actions workflow to review every pull request?',
    yes,
  )

  if (addGitHubActions) {
    installGitHubAction(projectRoot, dryRun)
  }

  // 2. Skill for generic agents
  console.log('\nInstalling Astro Doctor skill for coding agents...\n')

  for (const target of SKILL_TARGETS) {
    try {
      installTarget(target, projectRoot, dryRun)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      console.error(`  ✗ Failed to install ${target.label}: ${message}`)
    }
  }

  // 3. Agent-specific hooks (--agent-hooks or prompt)
  const detectedAgents = detectAgents(projectRoot)

  const shouldInstallHooks =
    options.agentHooks ||
    (detectedAgents.length > 0 &&
      (await confirm(
        `Detected ${detectedAgents.join(', ')} — install native agent hooks?`,
        yes,
      )))

  if (shouldInstallHooks) {
    console.log('\nInstalling native agent hooks...\n')

    for (const target of AGENT_HOOK_TARGETS) {
      try {
        installTarget(target, projectRoot, dryRun)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        console.error(`  ✗ Failed to install ${target.label}: ${message}`)
      }
    }
  }

  console.log('\nDone! Your coding agent will now apply Astro best practices.')

  console.log('Tip: re-run after upgrading astro-doctor to get the latest skill updates.\n')
}
