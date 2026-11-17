# Quality v2 pipeline rollout

Target: `release/v1.8.0`, the next minor after published `v1.7.0`.
Changesets remains responsible for coordinated package versions and changelogs.

The CLI is pinned to 2.0.0 and shared setup actions to immutable revision
`ff490e9efbd5fdfbdb1e6c404f1741d04c57f585`. CI records a committed-source
shadow plan in parallel with validation. CLI changes select its extension and
documentation consumers; shared configuration, package manifests, unknown
paths and missing Git history select the full graph. Plans do not execute jobs.
The existing validated Turbo selector still owns PR execution. Release, push
and manual runs retain full qualification. A failed planner prevents successful
CI completion and consequently blocks workflow-run publication and deployment.

Full validation now submits build, lint, type checking, coverage and export
checks to one Turbo dependency graph, allowing independent package tasks to run
concurrently. Repository lint, security checks, CI regression tests, Knip and
packed-install checks still execute afterward and fail on errors. Persistent
`.turbo/cache` storage is isolated by runner OS/architecture, Node configuration,
lockfile, Turbo configuration and revision; Turbo validates source/dependency
hashes inside that cache. Security audits remain fresh outside it.

Documentation builds explicitly bypass task-output caching because their footer
uses the current year. Their deployment retains exact validated-commit checks,
production serialization and the existing build-before-deploy boundary. Node
compatibility jobs retain separate runtime keys; Windows remains serial.

Validate changes with `pnpm run test:ci`,
`QUALITY_BINARY=/path/to/quality node --test scripts/quality-impact.node-test.mjs`,
`pnpm run lint` and `pnpm run typecheck`. Full pre-push qualification and hosted
CI/deployment proof are required before release. Local fixtures do not prove
hosted timing improvements. To recover, revert this rollout through a reviewed
commit; do not bypass existing release gates or move published tags.

Persisted Turbo task hashes include `QUALITY_TASK_RUNTIME`, captured after setup
from the actual Node and pnpm versions, platform, and architecture. This prevents
a broad cache restore from reusing outputs after a runtime patch changes, even
when the declared Node selector remains unchanged. Local runs without that
variable use a separate task identity.

## Release security qualification

The release audit identified glob cancellation, minimatch amplification and
Astro output-directory advisories. The direct glob catalog now uses 14.0.6;
scoped overrides constrain vulnerable glob 9–14 and minimatch 7–11 consumers
to 14.0.6 and 11.0.9. Import-x 4 consumers use 4.18.1 because older versions
rely on the removed matcher regular-expression API. Existing scanner fixtures
and dependency-security tests verify discovery, ignores, cancellation and
import-boundary enforcement. Remove these overrides when upstream ranges cover
the patched versions.

[Glob 14 migration notes](https://github.com/isaacs/node-glob/blob/main/changelog.md)
and [minimatch 11 migration notes](https://github.com/isaacs/minimatch/blob/main/changelog.md)
explain the non-recursive matcher and changed internal APIs. The CLI uses the
supported glob and globSync interfaces. Documentation uses Astro 7.4.12 with
its required Node 22.23.4 minimum; root/docs development engines and CI minimum
are aligned, while published CLI/plugin Node contracts remain unchanged.
These changes require no persistent data or secret migration.

A scoped pnpm package extension supplies `@emnapi/runtime` 1.11.3 to
`@astrojs/astro2tsx` 0.1.1, matching its declared core 1.11.3. Without that
missing dependency, the new bundler's separate runtime 2 beta can satisfy the
transitive peer and crash `astro check` with `bridge.setLastError`. Other
consumers retain their own runtime versions. Remove the extension when an
upstream release declares the matching runtime itself.
