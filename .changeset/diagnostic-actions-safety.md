---
"@santi020k/eslint-plugin-astro-doctor": patch
"@santi020k/astro-doctor": patch
---

Correct secret-env detection for static bracket access and destructuring while avoiding substring false positives. Recognize aliased Astro asset image imports, ignore unrelated custom components, check static source expressions, and reject disabled size inference.

Harden the GitHub Action with validated inputs, literal environment-based argument handling, isolated temporary reports, strict report checks, and failure propagation. Gate releases and documentation deployment on successful CI for the exact current main commit; manual runs reuse the full validation workflow.
