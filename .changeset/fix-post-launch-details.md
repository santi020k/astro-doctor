---
"@santi020k/eslint-plugin-astro-doctor": patch
"@santi020k/astro-doctor": patch
---

Fix post-launch documentation and plugin meta accuracy

- **eslint-plugin**: plugin `meta.version` now reads dynamically from `package.json` instead of being hardcoded to `0.1.0`
- **docs/README/llms.txt**: corrected score formula description — each file is scored independently (errors cost 25 pts, warnings cost 10 pts, clamped per-file then averaged); previous docs described the old global density formula
- **docs/README/action.yml**: updated score grade references from `A–F` to `S, A–F` to reflect that a perfect score of 100 returns the `S` grade; clarified that `S` means zero diagnostics — no issues found anywhere in the codebase (not just "high score" but truly clean); docs homepage grade cards now show a description label for each grade
