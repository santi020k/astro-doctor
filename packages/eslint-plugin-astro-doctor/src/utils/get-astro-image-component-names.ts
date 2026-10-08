import type { Rule } from 'eslint'

const IMAGE_COMPONENT_NAMES = new Set(['Image', 'Picture'])

export const getAstroImageComponentNames = (context: Rule.RuleContext): ReadonlySet<string> => {
  const componentNames = new Set<string>()

  for (const statementNode of context.sourceCode.ast.body) {
    if (statementNode.type !== 'ImportDeclaration' || statementNode.source.value !== 'astro:assets') continue

    for (const specifierNode of statementNode.specifiers) {
      if (specifierNode.type !== 'ImportSpecifier') continue

      const importedName = specifierNode.imported.type === 'Identifier' ?
        specifierNode.imported.name :
        specifierNode.imported.value

      if (typeof importedName === 'string' && IMAGE_COMPONENT_NAMES.has(importedName)) {
        componentNames.add(specifierNode.local.name)
      }
    }
  }

  return componentNames
}
