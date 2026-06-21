import type { Rule } from 'eslint'

export type RuleCategory =
  | 'performance'
  | 'accessibility'
  | 'security'
  | 'best-practices'
  | 'architecture'

export interface RuleMeta {
  readonly name: string
  readonly category: RuleCategory
  readonly description: string
  readonly recommended: boolean
}

export interface AstroDoctorRule extends Rule.RuleModule {
  readonly meta: Rule.RuleMetaData & {
    readonly docs: {
      readonly description: string
      readonly category: RuleCategory
      readonly recommended: boolean
      readonly url?: string
    }
    readonly messages: Record<string, string>
    readonly schema: Rule.RuleMetaData['schema']
  }
}
