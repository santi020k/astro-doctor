---
'@santi020k/astro-doctor': patch
---

Make GitHub Action releases reproducible by running the matching CLI package version with a supported Node.js runtime, automate the floating `v1` action tag, and correct package metadata for the Node.js requirement already introduced by the Astro parser dependency in 1.0.3. The VS Code extension now requires VS Code 1.125 or newer, launches its bundled language server with the supported Node.js executable from the user's environment instead of VS Code's embedded runtime, and includes the cross-platform WASI compiler required by Astro Parser 3.
