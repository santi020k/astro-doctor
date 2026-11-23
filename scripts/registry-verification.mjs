import {
  HTTP_NOT_FOUND_STATUS,
  HTTP_SERVER_ERROR_MIN_STATUS,
  HTTP_TOO_MANY_REQUESTS_STATUS,
  PUBLISH_VERIFY_BACKOFF_FACTOR,
  PUBLISH_VERIFY_INITIAL_DELAY_MS,
  PUBLISH_VERIFY_MAX_DELAY_MS,
  PUBLISH_VERIFY_TIMEOUT_MS,
} from './constants.ts'

const NPM_REGISTRY_URL = 'https://registry.npmjs.org'

export class NpmRegistryError extends Error {
  constructor(status, packageName, version) {
    super(`npm registry returned ${status} for ${packageName}@${version}`)

    this.name = 'NpmRegistryError'

    this.status = status
  }
}

export const getPackageVersionUrl = (packageName, version) => `${NPM_REGISTRY_URL}/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`

export const getPublishedVersion = async (packageName, version, fetchManifest = fetch) => {
  const response = await fetchManifest(getPackageVersionUrl(packageName, version), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })

  if (response.ok) {
    const manifest = await response.json()

    if (manifest?.name !== packageName || manifest?.version !== version) {
      throw new Error(`npm registry returned a mismatched manifest for ${packageName}@${version}`)
    }

    return manifest
  }

  if (response.status === HTTP_NOT_FOUND_STATUS) {
    return null
  }

  throw new NpmRegistryError(response.status, packageName, version)
}

export const isTransientRegistryError = error => error instanceof TypeError
  || (error instanceof NpmRegistryError
    && (error.status === HTTP_TOO_MANY_REQUESTS_STATUS || error.status >= HTTP_SERVER_ERROR_MIN_STATUS))

const pause = async delayMs => new Promise(resolve => {
  setTimeout(resolve, delayMs)
})

const readPublishedVersion = async (packageName, version, fetchManifest) => {
  try {
    return await getPublishedVersion(packageName, version, fetchManifest)
  } catch (error) {
    if (!isTransientRegistryError(error)) {
      throw error
    }

    return null
  }
}

export const waitForPublished = async (packageName, version, {
  fetchManifest = fetch,
  timeoutMs = PUBLISH_VERIFY_TIMEOUT_MS,
  initialDelayMs = PUBLISH_VERIFY_INITIAL_DELAY_MS,
  maxDelayMs = PUBLISH_VERIFY_MAX_DELAY_MS,
  backoffFactor = PUBLISH_VERIFY_BACKOFF_FACTOR,
} = {}) => {
  const deadline = Date.now() + timeoutMs
  let delayMs = initialDelayMs

  for (;;) {
    const manifest = await readPublishedVersion(packageName, version, fetchManifest)

    if (manifest) {
      return manifest
    }

    const remainingMs = deadline - Date.now()

    if (remainingMs <= 0) {
      return null
    }

    await pause(Math.min(delayMs, remainingMs))

    delayMs = Math.min(delayMs * backoffFactor, maxDelayMs)
  }
}

export const waitForAllPublished = async (releases, options = {}) => {
  const results = await Promise.allSettled(releases.map(async release => waitForPublished(release.packageName, release.version, options)))
  const failure = results.find(result => result.status === 'rejected')

  if (failure) {
    throw failure.reason
  }

  const missing = releases.filter((_release, index) => !results[index].value)

  if (missing.length > 0) {
    throw new Error(`Not found on the npm registry after publishing: ${missing.map(release => `${release.packageName}@${release.version}`).join(', ')}`)
  }

  return results.map(result => result.value)
}
