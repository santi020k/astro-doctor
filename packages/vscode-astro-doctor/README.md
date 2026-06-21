# Astro Doctor for VS Code

Astro Doctor diagnostics, hovers, and quick fixes right in your editor.

## Features

- **Live Diagnostics:** Real-time linting and health checks for your Astro files using Astro Doctor rules.
- **Quick Fixes:** Automatically fix common Astro anti-patterns and issues.
- **Health Sidebar:** Provides a visual health report with a score ring and category breakdown of issues (Performance, Accessibility, Security, etc.) inside the VS Code Sidebar.
- **Hover Info:** Get detailed explanations and rule documentation when hovering over reported issues.

## Extension Settings

This extension contributes the following settings:

* `astroDoctor.enable`: Enable or disable Astro Doctor features (default: `true`).
* `astroDoctor.serverPath`: Optional path to a custom `astro-doctor` executable. By default, it looks for your project's local install.
* `astroDoctor.scanOnType`: Re-scan files live as you type from the unsaved buffer (default: `true`).
* `astroDoctor.trace.server`: Trace communication with the underlying Astro Doctor Language Server (`off`, `messages`, `verbose`).

## Commands

* `Astro Doctor: Scan Workspace`
* `Astro Doctor: Scan Current File`
* `Astro Doctor: Suppress All Issues in File`
* `Astro Doctor: Restart Server`
* `Astro Doctor: Show Output`
* `Astro Doctor: Open Documentation`

## Links

- [Official Documentation](https://doctor.santi020k.com)
- [GitHub Repository](https://github.com/santi020k/astro-doctor)
- [Sponsor](https://github.com/sponsors/santi020k)
