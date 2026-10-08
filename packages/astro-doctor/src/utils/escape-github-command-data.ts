export const escapeGithubCommandData = (value: string): string => value
  .replaceAll('%', '%25')
  .replaceAll('\r', '%0D')
  .replaceAll('\n', '%0A')
