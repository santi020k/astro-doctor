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
