# Affected CI validation

Ordinary pull requests use the installed Turbo dependency graph to select changed
workspaces and their dependents. Run `pnpm run ci:plan --base <commit>` to inspect
selection, then `pnpm run ci:check --base <commit>` to execute it. The base should
be the target branch commit; the planner compares its merge base with HEAD and
also includes staged, unstaged, untracked, deleted, and renamed paths.

Release and Changesets branches, pushes, manual/reusable release validation,
`--full`, missing Git history, shared files, package manifests, imported package
changelogs, unknown paths, and invalid Turbo output use the complete original
command sequence. The planner never treats an unverified comparison as an empty
change. Use `pnpm run ci:check --full` to opt out locally.

Affected workspaces retain their full coverage, lint, type, build, and export
checks. CLI dependency builds remain prerequisites for repository-wide lint.
Repository lint, dependency-security regressions, selector regressions, and Knip
always run. Packed CLI/plugin installation runs when the CLI or its dependencies
are affected. Documentation browser installation and tests run when docs are
selected. The live dependency audit always runs in CI. Pre-push, compatibility,
and publication gates retain full validation.

## Benchmark

Measured on 2026-10-25, macOS ARM64, Node 22.23.1, pnpm 10.34.6. The source base was
`cf4cc7b684f151afc569a4dc97cdcf93205bb995`, with the rollout working copy copied
into temporary Git snapshot `d735525a3d0f291b630e1e145b1a8ae7c60763de`.

| Scenario | Cache | Full checks | Affected checks | Reduction |
| --- | --- | --- | --- | --- |
| Documentation page | Cold Turbo | 43.28 s | 17.07 s | 60.5% |
| Documentation page | Warm Turbo | 10.81 s | 6.71 s | 37.9% |
| ESLint plugin source | Cold Turbo | 34.35 s | 23.34 s | 32.1% |
| ESLint plugin source | Warm Turbo | 12.59 s | 12.47 s | 1.0% |
| Shared Turbo configuration | Cold Turbo | 40.23 s | 41.34 s | Full fallback |
| Shared Turbo configuration | Warm Turbo | 10.95 s | 10.54 s | Full fallback |

These are local code-check timings, including plan creation. Dependency
installation, the live audit (1.16 s), and browser suite (45.09 s; 13 passed) were
measured separately. Browser checks are still required for documentation changes.
Cold means an empty local Turbo cache; compiler and ESLint caches were prewarmed.
Each mode had a separate cache, remote caching was disabled, run order alternated,
and warm values are medians of two runs. An additional affected run passed from a
fresh checkout without build products. Small warm differences, including the
plugin result, are not meaningful evidence of a speedup. Hosted CI timings will
also include setup, network, and runner variability.

Reproduce with a clean temporary copy of tracked source, frozen dependency
installation, and a normal branch. Commit the baseline, then separately append a
comment to `apps/docs/src/pages/index.astro` and
`packages/eslint-plugin-astro-doctor/src/index.ts`, or whitespace to `turbo.json`.
Assert the plan is affected for the first two cases and full for the third. Run
`ci:check --full` and `ci:check --base <baseline>` serially with
`TURBO_CACHE=local:rw` and independent `TURBO_CACHE_DIR` directories. Warm both
compiler/lint caches first, then measure one cold and two warm runs per mode.

## Release and recovery

This rollout targets v1.6.0 and changes no CLI/configuration contracts. Vulnerable
transitive Vite, launch-editor, Storybook, Zod, Undici, and fast-uri resolutions
were updated to compatible stable releases. fast-uri 3.x overrides now stay on
the maintained 3.x security release instead of allowing an implicit major jump.

Rollback the CI optimization by running `pnpm run ci:check --full` unconditionally
and enabling both documentation steps. Keep the dependency fixes. If a published
package needs correction, ship a new patch version through the existing GitHub
release workflow; never move an existing release tag.
