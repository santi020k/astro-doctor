import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..')
const sourceSkillPath = join(repositoryRoot, 'skills/SKILL.md')
const packageDirectory = join(repositoryRoot, 'packages/astro-doctor')
const destinationDirectory = join(packageDirectory, 'dist/skills')
const destinationSkillPath = join(destinationDirectory, 'SKILL.md')

if (!existsSync(sourceSkillPath)) {
  throw new Error(`Skill source not found at ${sourceSkillPath}`)
}

mkdirSync(destinationDirectory, { recursive: true })

copyFileSync(sourceSkillPath, destinationSkillPath)

console.log(`Copied agent skill → ${destinationSkillPath}`)
