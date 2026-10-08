---
"@santi020k/astro-doctor": minor
---

Improve project discovery, diagnostic safety, and installed CLI setup:

- Preserve Unicode and whitespace in Git filenames and resolve changes relative to the selected project directory.
- Detect insecure session cookies in supported Astro config export forms and read only the workspace packages list.
- Package the agent skill with the CLI, report installation failures, and generate a workflow that checks config-only changes.
- Escape GitHub annotation properties, clean up failed baseline snapshots, and clear failed telemetry request timers.
- Offer line suppression actions only where JavaScript frontmatter supports them.

Refresh the pending dependency branches and compatible security fixes. Existing CLI flags and skill destinations remain supported.

Refresh the documentation with Lumen v4, the project's orange brand palette, accessible mobile
navigation, page and theme transitions, readable rule examples, and accurate score explanations.
Remove unused documentation dependencies and code, expand unused-code checks to the docs, and add
browser and dependency-security regression checks.

Add safe fix previews with `--fix-dry-run`, effective configuration explanations with
`explain-config <file>`, and baseline progress with full-scan pruning. Preview reports and JSON
include projected fix results; partial scans never claim resolved findings. Baseline pruning
preserves existing debt without accepting new findings and writes atomically. Parser failures
block previews and baseline comparisons/pruning without changing valid scan behavior. Existing JSON fields and the
baseline format remain compatible.

Parse TypeScript frontmatter consistently in the CLI, ESLint plugin, editor diagnostics and safe line suppressions. Fail ordinary lint scans on parser errors instead of returning a false clean health score, and keep parser error diagnostics visible in the editor. Ship the parser and its TypeScript runtime dependency for standalone installations.

Keep workspace config explanations and scans aligned with project presets, disambiguate fix-preview patch paths, and retain editor diagnostics when malformed files are present at startup.

Honor explicit CLI presets over workspace configuration and revalidate current main immediately before publishing, release metadata writes, and deployment.

Recount preview diagnostics after baseline filtering, reject config explanations for files excluded by selected workspace projects, and emit bounded, Git-applicable hunks for distant fixes.

Fail closed when recovering published-version metadata without a matching registry publishing SHA. Require full or files scope for fix previews, and mark unsupported file types excluded in config explanations.
