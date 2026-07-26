# Node.js support

Astro Doctor supports Node.js `^22.22.3 || ^24.16.0 || >=26.3.0`.

This range follows the runtime requirements of `eslint-plugin-astro` 3 and
`astro-eslint-parser` 3, which provide the current ESLint 10-compatible Astro
linting stack. Declaring a broader range would allow installations on runtimes
that these required dependencies do not support.

Node.js 20 support was briefly introduced after an automated compatibility
suggestion recommended using the older `eslint-plugin-astro` 1 and
`astro-eslint-parser` 1 lines. After validating the complete dependency graph,
we reverted that decision because Node.js 20 is end-of-life and maintaining it
would keep Astro Doctor on an older parser and plugin implementation.

## Support policy

- Follow supported Node.js release lines accepted by the current Astro ESLint
  parser and plugin.
- Do not advertise a Node.js version that a required runtime dependency rejects.
- Test the minimum supported release and the maintained newer release lines in
  CI.
- Treat temporary compatibility experiments as provisional until the packed
  dependency graph has been validated.
