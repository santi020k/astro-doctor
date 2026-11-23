import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getPackageVersionUrl,
  getPublishedVersion,
  NpmRegistryError,
  waitForAllPublished,
  waitForPublished,
} from './registry-verification.mjs'

const cliRelease = { packageName: '@santi020k/astro-doctor', version: '1.8.0' }
const pluginRelease = { packageName: '@santi020k/eslint-plugin-astro-doctor', version: '1.8.0' }
const manifestResponse = release => Response.json({ name: release.packageName, version: release.version, gitHead: 'abc123' })
const statusResponse = status => new Response(null, { status })

const createRegistry = visibleAfterMs => {
  const requests = []

  const fetchManifest = async url => {
    requests.push({ url, at: Date.now() })

    const release = [cliRelease, pluginRelease].find(candidate => getPackageVersionUrl(candidate.packageName, candidate.version) === url)

    return release && Date.now() >= visibleAfterMs[release.packageName] ? manifestResponse(release) : statusResponse(404)
  }

  return { fetchManifest, requests }
}

const settle = async () => {
  for (let turn = 0; turn < 20; turn += 1) await new Promise(resolve => {
    setImmediate(resolve)
  })
}

const advance = async (context, totalMs, stepMs = 500) => {
  await settle()

  for (let elapsedMs = 0; elapsedMs < totalMs; elapsedMs += stepMs) {
    context.mock.timers.tick(stepMs)

    await settle()
  }
}

const enableTimers = context => context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })

test('requests the version-specific manifest without caching', async () => {
  const calls = []

  const manifest = await getPublishedVersion(cliRelease.packageName, cliRelease.version, async (url, init) => {
    calls.push({ url, init })

    return manifestResponse(cliRelease)
  })

  assert.equal(manifest.gitHead, 'abc123')

  assert.deepEqual(calls, [{
    url: 'https://registry.npmjs.org/%40santi020k%2Fastro-doctor/1.8.0',
    init: { cache: 'no-store', headers: { Accept: 'application/json' } },
  }])
})

test('distinguishes missing versions, registry failures and mismatched manifests', async () => {
  assert.equal(await getPublishedVersion(cliRelease.packageName, cliRelease.version, async () => statusResponse(404)), null)

  await assert.rejects(
    getPublishedVersion(cliRelease.packageName, cliRelease.version, async () => statusResponse(403)),
    error => error instanceof NpmRegistryError && error.status === 403,
  )

  await assert.rejects(
    getPublishedVersion(cliRelease.packageName, cliRelease.version, async () => manifestResponse(pluginRelease)),
    /mismatched manifest/u,
  )
})

test('polls with capped exponential backoff until the version is visible', async context => {
  enableTimers(context)

  const registry = createRegistry({ [cliRelease.packageName]: 40_000 })
  const pending = waitForPublished(cliRelease.packageName, cliRelease.version, { fetchManifest: registry.fetchManifest })

  await advance(context, 45_000, 125)

  assert.equal((await pending).version, cliRelease.version)

  assert.deepEqual(registry.requests.map(request => request.at), [0, 2000, 5000, 9500, 16_250, 26_375, 41_375])
})

test('verifies every package concurrently instead of one after another', async context => {
  enableTimers(context)

  const registry = createRegistry({ [cliRelease.packageName]: 9000, [pluginRelease.packageName]: 9000 })
  const pending = waitForAllPublished([cliRelease, pluginRelease], { fetchManifest: registry.fetchManifest })

  await advance(context, 10_000)

  const manifests = await pending

  assert.deepEqual(manifests.map(manifest => manifest.name), [cliRelease.packageName, pluginRelease.packageName])

  assert.equal(Date.now(), 10_000)

  assert.deepEqual(registry.requests.slice(0, 2).map(request => request.at), [0, 0])
})

test('retries transient registry failures and network errors', async context => {
  enableTimers(context)

  const outcomes = [
    () => statusResponse(503),
    () => statusResponse(429),
    () => {
      throw new TypeError('fetch failed')
    },
    () => manifestResponse(cliRelease),
  ]

  let attempts = 0

  const pending = waitForPublished(cliRelease.packageName, cliRelease.version, {
    fetchManifest: async () => {
      attempts += 1

      return outcomes[attempts - 1]()
    },
  })

  await advance(context, 10_000)

  assert.equal((await pending).name, cliRelease.packageName)

  assert.equal(attempts, 4)
})

test('stops immediately on a permanent registry failure', async () => {
  await assert.rejects(
    waitForAllPublished([cliRelease, pluginRelease], { fetchManifest: async () => statusResponse(403) }),
    error => error instanceof NpmRegistryError && error.status === 403,
  )
})

test('fails with every missing package once the overall timeout elapses', async context => {
  enableTimers(context)

  const registry = createRegistry({ [cliRelease.packageName]: 0, [pluginRelease.packageName]: Number.POSITIVE_INFINITY })
  const pending = waitForAllPublished([cliRelease, pluginRelease], { fetchManifest: registry.fetchManifest })
  const outcome = assert.rejects(pending, /Not found on the npm registry after publishing: @santi020k\/eslint-plugin-astro-doctor@1\.8\.0$/u)

  await advance(context, 301_000, 1000)

  await outcome

  assert.equal(registry.requests.at(-1).at, 300_000)
})

test('resolves without requests when nothing was published', async () => {
  assert.deepEqual(await waitForAllPublished([], {
    fetchManifest: async () => {
      throw new Error('unexpected request')
    },
  }), [])
})
