import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, realpathSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const packageTasks = ['build', 'typecheck', 'lint', 'test:coverage', 'check:exports']
const docsPackage = '@santi020k/astro-doctor-docs'
const isReleaseNote = file => /^\.changeset\/[^/]+\.md$/u.test(file)
const fullScripts = ['typecheck', 'lint', 'build', 'test:coverage', 'lint:knip', 'check:exports', 'check:packed-install']

export const gitEnvironment = (environment = process.env) => Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith('GIT_')))

const capture = (command, arguments_, cwd, env) => execFileSync(command, arguments_, {
  cwd,
  encoding: 'utf8',
  env: command === 'git' ? gitEnvironment(env) : env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

export const requiresFullValidation = ({ full, event, headRef, files, workspaces }) => Boolean(
  full
  || (event && event !== 'pull_request')
  || /^(release\/|changeset-release\/)/u.test(headRef)
  || files.some(file => !isReleaseNote(file) && ((/\/(?:package\.json|CHANGELOG\.md)$/u.test(file)) || !workspaces.some(workspace => file.startsWith(`${workspace.directory}/`)))),
)

export const changedFiles = (cwd, base) => {
  const revision = capture('git', ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`], cwd).trim()
  const mergeBase = capture('git', ['merge-base', revision, 'HEAD'], cwd).trim()

  const commands = [
    ['diff', '--no-renames', '--name-only', '-z', mergeBase, 'HEAD'],
    ['diff', '--no-renames', '--name-only', '-z', '--cached'],
    ['diff', '--no-renames', '--name-only', '-z'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ]

  return {
    base: revision,
    files: [...new Set(commands.flatMap(arguments_ => capture('git', arguments_, cwd).split('\0').filter(Boolean)))].sort(),
  }
}

const fullPlan = reason => ({ mode: 'full', reason, docs: true, packages: true, commands: fullScripts.map(script => ['run', script]) })

const readWorkspaces = (cwd, env) => {
  const rootDirectory = realpathSync(cwd)
  const workspaceList = JSON.parse(capture(process.execPath, [env.npm_execpath, 'list', '--recursive', '--depth', '-1', '--json'], cwd, env))

  if (!Array.isArray(workspaceList)) throw new Error('Invalid workspace list')

  return workspaceList.map(workspace => {
    if (typeof workspace.name !== 'string' || typeof workspace.path !== 'string') throw new Error('Invalid workspace metadata')

    return { name: workspace.name, directory: relative(rootDirectory, workspace.path).replaceAll('\\', '/') }
  }).filter(workspace => workspace.directory && !workspace.directory.startsWith('../'))
}

const selectPackages = (cwd, env, changes, workspaces) => {
  const turboEnvironment = { ...gitEnvironment(env), TURBO_SCM_BASE: changes.base }

  delete turboEnvironment.TURBO_SCM_HEAD

  const graph = JSON.parse(capture(process.execPath, [env.npm_execpath, 'exec', 'turbo', 'run', ...packageTasks, '--affected', '--dry=json'], cwd, turboEnvironment))

  if (!Array.isArray(graph.packages) || !graph.packages.every(name => typeof name === 'string' && ((name === '//' && changes.files.some(isReleaseNote)) || workspaces.some(workspace => workspace.name === name)))) throw new Error('Invalid Turbo graph')

  const selected = [...new Set(graph.packages.filter(name => name !== '//'))].sort()

  for (const file of changes.files) {
    if (isReleaseNote(file)) continue

    const owner = workspaces.find(workspace => file.startsWith(`${workspace.directory}/`))

    if (!owner || !selected.includes(owner.name)) throw new Error('Turbo omitted a directly changed workspace')
  }

  return selected
}

const affectedPlan = (base, selected) => {
  const packages = selected.some(name => name !== docsPackage)

  return {
    mode: 'affected',
    reason: 'Turbo selects changed workspaces and their dependents',
    base,
    selected,
    docs: selected.includes(docsPackage),
    packages,
    commands: [
      ['exec', 'turbo', 'run', 'build', '--filter=@santi020k/astro-doctor...'],
      ['run', 'lint:repo'],
      ...(selected.length ? [['exec', 'turbo', 'run', ...packageTasks, ...selected.map(name => `--filter=${name}`)]] : []),
      ['run', 'check:dependency-security'],
      ['run', 'test:ci'],
      ['run', 'lint:knip'],
      ...(selected.includes('@santi020k/astro-doctor') ? [['run', 'check:packed-install']] : []),
    ],
  }
}

export const createPlan = ({ cwd = process.cwd(), base, full = false, env = process.env }) => {
  const event = env.GITHUB_EVENT_NAME
  const headRef = env.GITHUB_HEAD_REF || capture('git', ['branch', '--show-current'], cwd).trim()

  if (requiresFullValidation({ full, event, headRef, files: [], workspaces: [] })) return fullPlan('Release, push, manual run, or explicitly requested full validation')

  if (!base || !env.npm_execpath) return fullPlan('A Git base and repository package manager are required')

  try {
    const changes = changedFiles(cwd, base)
    const workspaces = readWorkspaces(cwd, env)

    return requiresFullValidation({ full, event, headRef, files: changes.files, workspaces }) ? fullPlan('Shared configuration, manifests, or unclassified files changed') : affectedPlan(changes.base, selectPackages(cwd, env, changes, workspaces));
  } catch {
    return fullPlan('Git comparison or Turbo selection could not be verified')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { base: { type: 'string' }, full: { type: 'boolean' }, plan: { type: 'boolean' } } })
  const plan = createPlan({ base: values.base || process.env.QUALITY_CI_BASE, full: values.full })

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)

  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `docs=${plan.docs}\npackages=${plan.packages}\nmode=${plan.mode}\n`)

  if (!values.plan) {
    if (!process.env.npm_execpath) throw new Error('Run this command through the repository package manager')

    for (const command of plan.commands) {
      const result = spawnSync(process.execPath, [process.env.npm_execpath, ...command], { stdio: 'inherit' })

      if (result.error) throw result.error

      if (result.status !== 0) {
        process.exitCode = result.status || 1

        break
      }
    }
  }
}
