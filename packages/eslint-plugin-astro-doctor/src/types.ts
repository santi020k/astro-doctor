import type { Rule } from 'eslint'

export type RuleCategory =
  | 'performance'
  | 'accessibility'
  | 'security'
  | 'best-practices'
  | 'architecture'


export interface AstroDoctorRule extends Rule.RuleModule {
  readonly meta: Omit<Rule.RuleMetaData, 'docs'> & {
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

export interface AstroNode {
  type?: string
  name?: string
  rawName?: string
  value?: string | boolean | number | AstroNode
  expression?: AstroNode
  expressions?: AstroNode[]
  operator?: string
  key?: { name?: string }
  startTag?: {
    attributes?: AstroNode[]
  }
  parent?: AstroNode
  attributes?: AstroNode[]
  [key: string]: unknown
}
