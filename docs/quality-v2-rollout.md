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
