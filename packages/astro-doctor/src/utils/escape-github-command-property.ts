import { escapeGithubCommandData } from './escape-github-command-data.js'

export const escapeGithubCommandProperty = (value: string): string => escapeGithubCommandData(value)
  .replaceAll(':', '%3A')
  .replaceAll(',', '%2C')
