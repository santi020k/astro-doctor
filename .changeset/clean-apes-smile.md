---
'@santi020k/astro-doctor': patch
---

Pin the bundled ESLint runtime to 10.5.0 so fresh CLI and GitHub Action installs remain compatible with `astro-eslint-parser` and do not crash on the removed `scopeManager.addGlobals` API.
