---
"@santi020k/astro-doctor": patch
---

Ignore diagnostics from ESLint rules that are not part of Astro Doctor's standalone scanner, and
inherit pnpm package-manager configuration from a workspace root when auditing included nested
projects. Package-manager audits now recognize npm, Yarn, and Bun lockfiles.
