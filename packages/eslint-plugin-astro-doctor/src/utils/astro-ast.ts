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

export const isAstroElementNode = (node: unknown): node is AstroElementNode =>
  isRecord(node) && (node.type === 'element' || node.type === 'component')

const getNodeName = (node: unknown): string | undefined => {
  if (!isRecord(node)) return undefined

  return typeof node.name === 'string' ? node.name : undefined
}

const getNodeStart = (node: Record<string, unknown>): number | undefined =>
  typeof node.start === 'number' ? node.start : undefined

const getNodePosition = (
  context: Rule.RuleContext,
  node: Record<string, unknown>,
): AstroPosition | undefined => {
  const start = getNodeStart(node)

  if (start === undefined) return undefined

  const location = context.sourceCode.getLocFromIndex(start)

  return {
    start: {
      line: location.line,
      column: location.column + 1,
    },
  }
}

const getJsxExpressionValue = (
  context: Rule.RuleContext,
  valueNode: Record<string, unknown>,
): string | undefined => {
  if (valueNode.type !== 'JSXExpressionContainer' || !isRecord(valueNode.expression)) {
    return undefined
  }

  const expressionStart = getNodeStart(valueNode.expression)
  const expressionEnd = valueNode.expression.end

  if (expressionStart === undefined || typeof expressionEnd !== 'number') return undefined

  return context.sourceCode.text.slice(expressionStart, expressionEnd)
}

const getJsxLiteralValue = (
  valueNode: Record<string, unknown>,
): string | boolean | number | null | undefined => {
  if (!('value' in valueNode)) return undefined

  const literalValue = valueNode.value

  if (
    typeof literalValue === 'string' ||
    typeof literalValue === 'boolean' ||
    typeof literalValue === 'number' ||
    literalValue === null
  ) {
    return literalValue
  }

  return undefined
}

const normalizeJsxAttribute = (
  context: Rule.RuleContext,
  node: unknown,
): AstroAttributeNode | undefined => {
  if (!isRecord(node) || node.type !== 'JSXAttribute') return undefined

  const name = getNodeName(node.name)

  if (!name) return undefined

  const valueNode = node.value
  let kind: string | undefined
  let value: string | boolean | number | null = true

  if (isRecord(valueNode)) {
    const expressionValue = getJsxExpressionValue(context, valueNode)
    const literalValue = getJsxLiteralValue(valueNode)

    if (valueNode.type === 'JSXExpressionContainer') {
      kind = 'expression'
    }

    if (expressionValue !== undefined) {
      value = expressionValue
    } else if (literalValue !== undefined) {
      value = literalValue
    }
  }

  return {
    type: 'attribute',
    name,
    kind,
    value,
    position: getNodePosition(context, node),
  }
}

const normalizeJsxElement = (
  context: Rule.RuleContext,
  node: Record<string, unknown>,
): AstroElementNode | undefined => {
  if (node.type !== 'JSXElement' || !isRecord(node.openingElement)) return undefined

  const name = getNodeName(node.openingElement.name)

  if (!name) return undefined

  const rawAttributes = Array.isArray(node.openingElement.attributes)
    ? node.openingElement.attributes
    : []

  const attributes = rawAttributes
    .map((attributeNode) => normalizeJsxAttribute(context, attributeNode))
    .filter((attributeNode) => attributeNode !== undefined)

  const rawChildren = Array.isArray(node.children) ? node.children : []

  const children = rawChildren
    .map((childNode) =>
      isRecord(childNode) ? normalizeJsxElement(context, childNode) : undefined,
    )
    .filter((childNode) => childNode !== undefined)

  return {
    type: 'element',
    name,
    attributes,
    children,
    position: getNodePosition(context, node),
  }
}

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
  context: Rule.RuleContext,
  node: unknown,
  visitor: (elementNode: AstroElementNode) => void,
): void => {
  if (!isRecord(node)) return

  if (isAstroElementNode(node)) {
    visitor(node)
  } else {
    const normalizedElement = normalizeJsxElement(context, node)

    if (normalizedElement) {
      visitor(normalizedElement)

      for (const childNode of normalizedElement.children ?? []) {
        visitElements(context, childNode, visitor)
      }

      return
    }
  }

  let children: unknown[] = []

  if (Array.isArray(node.children)) {
    children = node.children
  } else if (Array.isArray(node.body)) {
    children = node.body
  }

  for (const childNode of children) {
    visitElements(context, childNode, visitor)
  }
}

export const forEachAstroElement = (
  context: Rule.RuleContext,
  visitor: (elementNode: AstroElementNode) => void,
): void => {
  visitElements(context, getAstroAst(context), visitor)
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
