import assert from 'node:assert/strict'
import test from 'node:test'

import { validateReleaseMetadata } from './release-metadata.mjs'

const valid = {
  branch: 'release/v1.8.0',
  packages: [{ name: 'cli', version: '1.8.0', changelog: '# Changelog\n\n## 1.8.0\n' }, { name: 'plugin', version: '1.8.0', changelog: '## 1.8.0\n' }],
  fragments: ['README.md', 'config.json'],
}

test('consumed release requires every coordinated version and changelog', () => {
  assert.doesNotThrow(() => validateReleaseMetadata(valid))

  for (const changes of [
    { branch: 'release/v1.7.0' },
    { packages: [] },
    { packages: [...valid.packages, { name: 'extension', version: '1.7.0', changelog: '## 1.7.0' }] },
    { packages: [{ name: 'cli', version: '1.8.0', changelog: '## 1.7.0' }] },
    { fragments: ['pending.md'] },
  ]) assert.throws(() => validateReleaseMetadata({ ...valid, ...changes }))
})
