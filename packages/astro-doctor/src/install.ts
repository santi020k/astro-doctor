import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILLS_SOURCE_DIR = resolve(fileURLToPath(import.meta.url), '../../../..')

interface SkillTarget {
  readonly sourceFile: string
  readonly destDir: string
  readonly destFile: string
  readonly label: string
}

const SKILL_TARGETS: SkillTarget[] = [
  {
    sourceFile: resolve(SKILLS_SOURCE_DIR, 'skills/SKILL.md'),
    destDir: 'skills',
    destFile: 'astro-doctor.md',
    label: 'Astro Doctor rules (skills/astro-doctor.md)',
  },
]

const installSkill = (target: SkillTarget, projectRoot: string): void => {
  const destDirectory = join(projectRoot, target.destDir)
  const destPath = join(destDirectory, target.destFile)

  if (!existsSync(destDirectory)) {
    mkdirSync(destDirectory, { recursive: true })
  }

  const content = readFileSync(target.sourceFile, 'utf8')
  writeFileSync(destPath, content, 'utf8')
  console.log(`  ✓ Installed ${target.label}`)
}

export const runInstall = (projectRoot = process.cwd()): void => {
  console.log('\nInstalling Astro Doctor agent skills...\n')

  const packageJsonPath = join(projectRoot, 'package.json')

  if (!existsSync(packageJsonPath)) {
    console.warn('  ⚠ No package.json found — make sure you run this from your project root.')
  }

  for (const target of SKILL_TARGETS) {
    try {
      installSkill(target, projectRoot)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  ✗ Failed to install ${target.label}: ${message}`)
    }
  }

  console.log('\nDone! Your coding agent will now apply Astro best practices.\n')
  console.log('Tip: re-run after upgrading astro-doctor to get the latest skill updates.\n')
}
