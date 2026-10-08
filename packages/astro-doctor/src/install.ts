import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

import { getGithubWorkflow } from './utils/get-github-workflow.js'

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url))

const resolveSkillSourceFile = (): string => {
  const packagedSkillPath = resolve(MODULE_DIRECTORY, '../skills/SKILL.md')

  return existsSync(packagedSkillPath) ?
    packagedSkillPath :
    resolve(MODULE_DIRECTORY, '../../../skills/SKILL.md')
}

const SKILL_SOURCE_FILE = resolveSkillSourceFile()

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
    sourceFile: SKILL_SOURCE_FILE,
    destDir: 'skills',
    destFile: 'astro-doctor.md',
    label: 'Astro Doctor rules (skills/astro-doctor.md)'
  }
]

// Agent hook directories that support a skills/ convention
const AGENT_HOOK_TARGETS: SkillTarget[] = [
  {
    sourceFile: SKILL_SOURCE_FILE,
    destDir: '.claude/skills',
    destFile: 'astro-doctor.md',
    label: 'Claude Code hook (.claude/skills/astro-doctor.md)'
  },
  {
    sourceFile: SKILL_SOURCE_FILE,
    destDir: '.cursor/rules',
    destFile: 'astro-doctor.mdc',
    label: 'Cursor rule (.cursor/rules/astro-doctor.mdc)'
  }
]

const prompt = (question: string): Promise<string> => new Promise(resolve => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  rl.question(question, answer => {
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

  writeFileSync(workflowPath, getGithubWorkflow(), 'utf8')

  console.log('  ✓ Created .github/workflows/astro-doctor.yml')
}

const tryInstallTarget = (target: SkillTarget, projectRoot: string, dryRun: boolean): boolean => {
  try {
    installTarget(target, projectRoot, dryRun)

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`  ✗ Failed to install ${target.label}: ${message}`)

    return false
  }
}

const installAllTargets = (
  targets: readonly SkillTarget[],
  projectRoot: string,
  dryRun: boolean
): boolean => {
  let allSucceeded = true

  for (const target of targets) {
    if (!tryInstallTarget(target, projectRoot, dryRun)) allSucceeded = false
  }

  return allSucceeded
}

const detectAgents = (projectRoot: string): string[] => {
  const detected: string[] = []

  if (existsSync(join(projectRoot, '.claude'))) detected.push('Claude Code')

  if (existsSync(join(projectRoot, '.cursor'))) detected.push('Cursor')

  if (existsSync(join(projectRoot, '.codeium'))) detected.push('Windsurf')

  if (existsSync(join(projectRoot, '.github/copilot-instructions.md'))) detected.push('GitHub Copilot')

  return detected
}

const installHooksIfRequested = async (options: InstallOptions): Promise<boolean> => {
  const detectedAgents = detectAgents(options.projectRoot)

  const shouldInstallHooks =
    options.agentHooks ||
    (detectedAgents.length > 0 &&
      (await confirm(
        `Detected ${detectedAgents.join(', ')} — install native agent hooks?`, options.yes
      )))

  if (!shouldInstallHooks) return true

  console.log('\nInstalling native agent hooks...\n')

  return installAllTargets(AGENT_HOOK_TARGETS, options.projectRoot, options.dryRun)
}

const reportInstallOutcome = (allTargetsSucceeded: boolean): void => {
  if (!allTargetsSucceeded) {
    console.log('\nCompleted with errors — see above for details. Your coding agent setup is incomplete.\n')

    process.exitCode = 1

    return
  }

  console.log('\nDone! Your coding agent will now apply Astro best practices.')

  console.log('Tip: re-run after upgrading astro-doctor to get the latest skill updates.\n')
}

export const runInstall = async (
  argv: string[] = [],
  projectRoot = process.cwd()
): Promise<void> => {
  const options: InstallOptions = {
    yes: argv.includes('-y') || argv.includes('--yes'),
    dryRun: argv.includes('--dry-run'),
    agentHooks: argv.includes('--agent-hooks'),
    projectRoot
  }

  console.log('\nAstro Doctor — Interactive Setup\n')

  if (options.dryRun) {
    console.log('  Running in dry-run mode — no files will be written.\n')
  }

  const packageJsonPath = join(projectRoot, 'package.json')

  if (!existsSync(packageJsonPath)) {
    console.warn('  ⚠ No package.json found — make sure you run this from your project root.\n')
  }

  if (await confirm('Add GitHub Actions workflow to review every pull request?', options.yes)) {
    installGitHubAction(projectRoot, options.dryRun)
  }

  console.log('\nInstalling Astro Doctor skill for coding agents...\n')

  const skillsInstalled = installAllTargets(SKILL_TARGETS, projectRoot, options.dryRun)
  const hooksInstalled = await installHooksIfRequested(options)

  reportInstallOutcome(skillsInstalled && hooksInstalled)
}
