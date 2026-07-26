import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)))
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'astro-doctor-packed-install-'))
const tarballDirectory = join(temporaryDirectory, 'tarballs')

const packageDirectories = [
  join(rootDirectory, 'packages/eslint-plugin-astro-doctor'),
  join(rootDirectory, 'packages/astro-doctor'),
]

try {
  mkdirSync(tarballDirectory, { recursive: true })

  for (const packageDirectory of packageDirectories) {
    execFileSync('pnpm', ['pack', '--pack-destination', tarballDirectory], {
      cwd: packageDirectory,
      stdio: 'pipe',
    })
  }

  const tarballs = readdirSync(tarballDirectory)
    .map((tarballName) => join(tarballDirectory, tarballName))

  const manifest = {
    name: 'astro-doctor-packed-install',
    private: true,
    type: 'module',
    version: '0.0.0',
  }

  writeFileSync(
    join(temporaryDirectory, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  execFileSync(
    'pnpm',
    [
      'exec',
      'npm',
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      ...tarballs,
    ],
    {
      cwd: temporaryDirectory,
      stdio: 'pipe',
    },
  )

  const pluginManifest = JSON.parse(
    readFileSync(
      join(
        temporaryDirectory,
        'node_modules/@santi020k/eslint-plugin-astro-doctor/package.json',
      ),
      'utf8',
    ),
  )

  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
        import { ESLint } from 'eslint'
        import astroDoctorPlugin, {
          RECOMMENDED_RULES,
        } from '@santi020k/eslint-plugin-astro-doctor'

        const eslint = new ESLint({
          overrideConfigFile: true,
          overrideConfig: [{
            ...astroDoctorPlugin.configs.recommended,
            rules: RECOMMENDED_RULES,
          }],
        })
        const [result] = await eslint.lintText(
          '<html><body><img src="/hero.jpg"></body></html>',
          { filePath: 'fixture.astro' },
        )
        const ruleIds = result.messages.map((message) => message.ruleId)
        const expectedRuleIds = [
          'astro-doctor/no-missing-alt',
          'astro-doctor/no-missing-lang',
        ]

        if (
          result.fatalErrorCount > 0 ||
          expectedRuleIds.some((ruleId) => !ruleIds.includes(ruleId))
        ) {
          throw new Error(JSON.stringify(result.messages))
        }
      `,
    ],
    {
      cwd: temporaryDirectory,
      stdio: 'pipe',
    },
  )

  process.stdout.write(
    `Packed Astro Doctor ${pluginManifest.version} installed and linted with ` +
    `Node.js ${process.version}.\n`,
  )
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
