# Astro Doctor 1.5.0 release preparation

This release is being prepared locally on `release/v1.5.0`, based on the released 1.4.0
`main`. Publishing packages, pushing branches, opening or merging pull requests, and deploying
are separate authorized release actions.

## Scope

- Preserve the consolidated dependency branches, README changes, and CLI reliability fixes.
- Adopt Lumen Astro/core 4.0.0 and compatible stable dependencies, keeping the declared Node
  engine range and pnpm 10. Remove unused MDX, direct legacy social-image rendering packages,
  duplicate docs Wrangler, obsolete animation code, unused rule style maps, and unused exports.
- Apply the shared sculpted header, solid surfaces, editorial hierarchy, and footer to the
  documentation while retaining Astro Doctor's orange/amber, charcoal/cream, and Montserrat.
- Improve all documentation route families, syntax contrast, mobile navigation, copy controls,
  keyboard scrolling, page/theme transitions, reduced motion, and no-JavaScript reading.
- Correct health-score examples and installation destinations against the current CLI contracts.
- Restrict LSP line suppression to JavaScript insertion points outside multiline tokens/comments.

No package API or CLI migration is required. TypeScript remains at 6.0.3 because the latest
Astro checker and owned ESLint TypeScript configuration do not yet support TypeScript 7.
The existing Changeset selects the minor version through the repository's release workflow.

## Security dependency constraint

The narrowly scoped `micromark-extension-math@3.1.0>katex: 0.19.0` override addresses
[the KaTeX inherited-trust advisory](https://github.com/advisories/GHSA-238p-pmpm-9mq7). The consumer is
`@eslint/markdown`, which uses the math syntax parser, not HTML rendering. The reviewed KaTeX
0.17–0.19 breaking changes affect internal rendering APIs, CSS prefixes, and missing-glyph
warnings; they do not alter this consumer. `pnpm run check:dependency-security` verifies the
inherited-trust regression, explicit-trust control, ordinary rendering, and actual Markdown
math parsing. Remove this override when the upstream dependency accepts a patched release.

## Validation

Required local gates: `pnpm run ok`, `pnpm run lint:knip`, `pnpm run check:exports`,
`pnpm run check:packed-install`, `pnpm run lint:spell`, `pnpm audit`, and `pnpm audit --prod`.
The docs build includes generation and an audit of social metadata, images, and sitemap.

`pnpm --filter @santi020k/astro-doctor-docs run test:browser` checks all 37 routes in light
and dark themes at 390px and 1440px, plus keyboard navigation, theme/copy/tab behavior across
Astro swaps, 320px/enlarged text, and no-JavaScript reading. CI runs this browser suite after
its normal build and repository checks. Temporary screenshots are verification evidence,
not committed visual baselines.

The independent review identified unsafe suppression in multiline template text and inaccurate
installer documentation. Both were accepted and corrected with regression or source-contract
verification. The controlled theme toggle also now synchronizes its pressed state.

The completed browser run passed all 10 tests, including 148 route/theme/viewport accessibility
checks with no violations. A fresh CI-style server run passed two interaction checks and confirmed
that Playwright stopped both server processes. Native page and theme transitions were also checked
with normal motion enabled. Both full and production dependency audits report zero vulnerabilities.
The combined workspace passed `pnpm run ok`, `pnpm run lint:knip`, `pnpm run check:exports`,
`pnpm run check:packed-install`, and `pnpm run lint:spell`. The packed install was verified on
Node.js 22.23.1, including non-empty agent skills and the generated workflow.

The dependency resolver still reports upstream peer ranges for `eslint-plugin-jsx-a11y` with
ESLint 10 and the older TypeScript utilities inside `eslint-plugin-tsdoc` with TypeScript 6.
These existing transitive declarations were not hidden with peer overrides or weaker lint rules;
the repository's lint and type-check gates remain required.

## Integration and recovery

All earlier dependency branch tips are contained in the release. Historical stashes were
inspected and preserved: their obsolete release-workflow and old package-manager-tab changes
would regress the current release. Do not reapply them blindly. Preserve checkouts owned by
other active tasks even after their completed commits are integrated.

The documentation and reliability work is committed as `fadb9b4`. The release also integrates
the completed ESLint tooling and typed VS Code mock update from `6761b72`, retaining the Lumen v4
upgrade, removed documentation dependencies, and scoped KaTeX security constraint.

Before publishing, rerun the documented GitHub checks and required reviews on the final release
revision. Use the existing GitHub release workflow from merged `main`; do not create a local tag
or publish manually. For a docs regression, revert the relevant source commit and let the normal
GitHub deployment rebuild it. For published package regressions, ship a corrective version;
never move published tags. This release changes no persisted consumer data or secret values.
