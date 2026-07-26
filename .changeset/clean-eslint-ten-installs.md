---
"@santi020k/astro-doctor": patch
"@santi020k/eslint-plugin-astro-doctor": patch
---

Remove the incompatible `eslint-plugin-jsx-a11y` dependency so clean installs work with ESLint 10 on Node.js 20. Astro Doctor's proprietary accessibility diagnostics and official Astro rules remain enabled.
