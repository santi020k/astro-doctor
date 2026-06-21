import type { Rule } from 'eslint'

interface AstroPositionPoint {
  readonly line: number
  readonly column: number
}

interface AstroPosition {
  readonly start?: AstroPositionPoint
}

interface AstroParserServices {
  readonly getAstroAst?: () => unknown
}

interface ParserServiceSourceCode {
  readonly parserServices?: AstroParserServices
}

interface AstroNodeBase {
  readonly type?: string
  readonly position?: AstroPosition
}

export interface AstroAttributeNode extends AstroNodeBase {
  readonly name?: string
  readonly kind?: string
  readonly value?: string | boolean | number | null
}

export interface AstroElementNode extends AstroNodeBase {
  readonly name?: string
  readonly attributes?: readonly AstroAttributeNode[]
  readonly children?: readonly unknown[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isAstroElementNode = (node: unknown): node is AstroElementNode =>
  isRecord(node) && (node.type === 'element' || node.type === 'component')

interface ReportLocation {
  readonly line: number
  readonly column: number
}

interface AstroReportDescriptor {
  readonly loc: ReportLocation
  readonly messageId: string
}

const getParserServiceSourceCode = (context: Rule.RuleContext): ParserServiceSourceCode =>
  context.sourceCode

const getAstroAst = (context: Rule.RuleContext): unknown => {
  const parserServices = getParserServiceSourceCode(context).parserServices

  return parserServices?.getAstroAst?.()
}

const getReportLocation = (node: AstroNodeBase): ReportLocation => {
  const line = node.position?.start?.line ?? 1
  const column = Math.max(0, (node.position?.start?.column ?? 1) - 1)

  return { line, column }
}

const visitElements = (
  node: unknown,
  visitor: (elementNode: AstroElementNode) => void,
): void => {
  if (!isRecord(node)) return

  if (isAstroElementNode(node)) {
    visitor(node)
  }

  const children = Array.isArray(node.children) ? node.children : []

  for (const childNode of children) {
    visitElements(childNode, visitor)
  }
}

export const forEachAstroElement = (
  context: Rule.RuleContext,
  visitor: (elementNode: AstroElementNode) => void,
): void => {
  visitElements(getAstroAst(context), visitor)
}

export const forEachAstroAttribute = (
  context: Rule.RuleContext,
  visitor: (attributeNode: AstroAttributeNode, elementNode: AstroElementNode) => void,
): void => {
  forEachAstroElement(context, (elementNode) => {
    for (const attributeNode of elementNode.attributes ?? []) {
      visitor(attributeNode, elementNode)
    }
  })
}

export const reportAstroNode = (
  context: Rule.RuleContext,
  node: AstroNodeBase,
  messageId: string,
): void => {
  const descriptor: AstroReportDescriptor = {
    loc: getReportLocation(node),
    messageId,
  }

  context.report(descriptor)
}
