import { readdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const validateReleaseMetadata = ({ branch, packages, fragments }) => {
  if (!/^release\/v\d+\.\d+\.\d+(?:-[\da-z.-]+)?$/iu.test(branch)) throw new Error('Expected a versioned release branch.')

  if (packages.length === 0) throw new Error('Expected coordinated release packages.')

  for (const { name, version, changelog } of packages) {
    if (branch !== `release/v${version}`) throw new Error(`${name} does not match the release version.`)

    if (!changelog.split(/\r?\n/u).includes(`## ${version}`)) throw new Error(`${name} is missing release notes.`)
  }

  if (fragments.some(name => name.endsWith('.md') && name !== 'README.md')) throw new Error('Consume pending Changesets before release.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../', import.meta.url)
  const configuration = JSON.parse(readFileSync(new URL('.changeset/config.json', root), 'utf8'))
  const names = configuration.fixed.flat()

  const packages = readdirSync(new URL('packages/', root), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const directory = new URL(`packages/${entry.name}/`, root)
    const manifest = JSON.parse(readFileSync(new URL('package.json', directory), 'utf8'))

    return { ...manifest, changelog: names.includes(manifest.name) ? readFileSync(new URL('CHANGELOG.md', directory), 'utf8') : '' }
  }).filter(manifest => names.includes(manifest.name))

  if (packages.length !== names.length) throw new Error('Missing coordinated release package.')

  validateReleaseMetadata({ branch: process.argv[2], packages, fragments: readdirSync(new URL('.changeset/', root)) })

  console.log(`Verified consumed metadata for ${packages.length} release packages.`)
}
