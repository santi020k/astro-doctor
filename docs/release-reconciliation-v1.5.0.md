# Astro Doctor 1.5.0 reconciliation

Inventory verified on 2026-10-08. Preparation uses an independent checkout at
`/Users/santi020k/Documents/Codex/2026-10-08/task-4/astro-doctor`; the primary checkout and
existing diagnostic-improvements worktree remain untouched. Both implementation chats were idle
when preparation began. The README author had finished and left documented pending integrations.

| Source | Disposition | Evidence |
| --- | --- | --- |
| `main` / `origin/main` | Already included | `3b93970cfee81c4dd15ea63bfeb9c20cbcd2668f` is the release base. |
| Existing `release/v1.5.0` worktree | Integrated | `eb4de45369dee337ea7ab468ff01800fecbb24e2` retains docs, Lumen v4, tooling, rules, Action hardening, fix previews, config explanations, baseline progress and pruning. |
| `feature/diagnostic-workflows` | Already included | `5109556f03f3de38c95c8e2c6e7a7cf5106f1fa5` is an ancestor of the release. |
| Dependabot Actions branch / PR #54 | Already included | `8eb2441378b97eea098401b628d79c0f23570da5` is an ancestor. |
| Dependabot production dependencies / PR #55 | Already included | `eb6e6cfaaf9f8ac3fa78e641a62709885ca87d8d` is an ancestor; newer compatible resolutions and security fixes remain. |
| Dependabot Turbo / PR #56 | Already included | `d6152cf008d4db6f53eddbdf93b8a9e1abacdf33` is an ancestor; release uses 2.11.7. |
| Dependabot Lumen Astro / PR #57 | Already included | `c41f2d207c987914a954b3b69b46b04147f32487` is an ancestor; release deliberately advances to Lumen 4. |
| Six primary-checkout README edits and six `docs/assets/readme` files | Integrated | Copied patch applied with three-way context; originals preserved. Corrected canonical docs link and duplicate “up to” wording. |
| `stash@{0}` | Intentional historical scope | Obsolete CI/publishing snapshot; current exact-commit validation supersedes it. Preserved in the original repository. |
| `stash@{1}`, `stash@{2}`, `stash@{3}` | Intentional historical scope | Duplicate lint-staged snapshots of old package-manager tabs/dependencies and consumed changesets. Current docs use the maintained Lumen implementation. Reapplication would regress completed work; snapshots preserved. |

No source branches, worktree checkouts, stashes, or original uncommitted files were deleted or reset.
Remote `main` and all four Dependabot branches were checked live. No additional remote feature
or release branch existed at initial inventory. Original README patch SHA-256:
`07ce18f1b0d8132bc5eaae4ebbb3dcfaee32780faf5e9e7a9423e7c0ebe27a54`.

## Release path and credentials

`main` requires the exact `Required checks` check, up-to-date PRs, linear history, and resolved
conversations; administrators are subject to protection. Merge through GitHub using its supported
linear-history option. This preparation does not merge, deploy, tag, or publish.

The existing Changeset selects 1.5.0 for the fixed CLI/plugin/Oxlint/extension group. Manifests
remain 1.4.0 until the normal Changesets version PR. Merging preparation first runs main CI;
only successful current-main CI enables Release and Deploy Docs. The version PR must then receive
its own checks and user merge before package/editor publishing. Docs can deploy after the first
merge, so that user action is also the deployment authorization point.

Repository secret-name inventory confirms `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
`OVSX_PAT`, `VSCE_PAT`, `TURBO_TEAM`, `TURBO_TOKEN`, `NPM_TOKEN`, and `PA_TOKEN`. No values were
read or exported. `npm` and `docs-production` environments allow only `main`, and have no separate
environment secrets. CI uses optional Turbo cache credentials; publishing uses npm OIDC with
`id-token: write`, rather than the legacy `NPM_TOKEN`.

GitHub account access is verified. Local npm `whoami` returns 401; it is not the CI OIDC identity.
Prior release and docs runs succeeded on 2026-09-25/26, which is historical evidence only.
The existing Cloudflare OAuth identity and read-only Pages project listing were verified; the
project name and canonical domain match the workflow. This does not validate the separate
GitHub-stored Cloudflare token. Current GitHub-stored PATs and Cloudflare token validity cannot
be proven from secret metadata.
`CHANGESETS_TOKEN` is absent; the workflow falls back to `github.token`. A version PR created
with that token does not trigger ordinary pull-request workflows automatically. The existing credential-free recovery is a user-triggered CI workflow dispatch on the generated
version PR branch; its `Required checks` must pass on that exact SHA before user merge.
Alternatively, specifically approve a narrowly scoped Changesets automation credential. No
credential mutation or persistent permission expansion is part of this preparation.

## Preparation validation

The fresh candidate passed type checking, build (37 docs pages with no metadata audit issues),
workspace coverage and dependency-security regressions, unused-code and export checks, standalone
packed installation including typed Astro frontmatter, spelling, and full/production audits
with zero known vulnerabilities. All 12 browser checks passed, covering the 37 docs routes
in both themes at mobile and desktop widths plus interaction and accessibility checks.
The native editor smoke exchanges actual initialize/open/change protocol messages with its
bundled server, including typed frontmatter and malformed-buffer diagnostics.

Independent review reproduced a false-clean typed-frontmatter scan. The CLI, plugin, and editor
now use the supported TypeScript parser; ordinary scans reject parse failures and editor
diagnostics retain fatal parse messages. Regression fixtures use valid Astro script markup.
GitHub checks must still be verified on the committed final SHA; local evidence alone does not
confirm merge or deployment readiness.

GitHub Codex review found three workspace/editor gaps in the first preparation commit.
The follow-up expands each selected project preset after configuration merging, emits
workspace preview patch paths relative to the invocation root, and keeps editor initialization
alive while retaining fatal on-disk parser diagnostics. CLI scans and baseline creation/pruning
remain strict. Regressions include applying a two-project patch from the workspace root and
starting the real bundled editor server with malformed source already on disk.

A second Codex pass identified explicit CLI preset precedence and stale-main mutation windows.
Explicit preset flags now win over both root and project configuration in scans, explanations,
and baseline comparison. Release metadata writes are owned by the repository script, with
a fresh current-main check before each npm publish, package tag push, and GitHub release API
write. Automatic Changesets tag/release writes are disabled. Dedicated validated command
scripts enforce the gate after version/package preparation, and docs, umbrella tags, and
both editor registries repeat it directly before their mutation commands. Temporary Git and
intercepted registry/API regressions verify that advancing main blocks stale writes.

A third Codex pass found preview counts retained before baseline filtering, explanations for
files outside selected projects, and oversized diff hunks around distant fixes. The candidate
recounts filtered previews, rejects excluded-file explanations, and uses the packaged diff
runtime to generate bounded Git patches. Regressions verify JSON count consistency and
apply separated hunks, whitespace paths, empty files and missing final newlines with Git.
