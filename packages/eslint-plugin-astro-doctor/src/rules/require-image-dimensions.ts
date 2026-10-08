import { RULE_DOCS_BASE_URL } from '../constants.js'
import type { AstroAttributeNode } from '../utils/astro-ast.js'
import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { getAstroAttribute } from '../utils/attribute.js'
import { getAstroImageComponentNames } from '../utils/get-astro-image-component-names.js'
import { getStaticAstroAttributeValue } from '../utils/get-static-astro-attribute-value.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const SOURCE_ATTRIBUTE_NAME = 'src'
const WIDTH_ATTRIBUTE_NAME = 'width'
const HEIGHT_ATTRIBUTE_NAME = 'height'
const INFER_SIZE_ATTRIBUTE_NAME = 'inferSize'
const REMOTE_SOURCE_PREFIXES = ['https://', 'http://', '//']
const PUBLIC_SOURCE_PREFIX = '/'

const isRemoteSource = (
  sourceValue: string
): boolean => REMOTE_SOURCE_PREFIXES.some(sourcePrefix => sourceValue.startsWith(sourcePrefix))

const hasExplicitDimensions = (
  attributes: readonly AstroAttributeNode[]
): boolean => Boolean(getAstroAttribute(attributes, WIDTH_ATTRIBUTE_NAME)) &&
  Boolean(getAstroAttribute(attributes, HEIGHT_ATTRIBUTE_NAME))

const hasSizeInference = (attributes: readonly AstroAttributeNode[]): boolean => {
  const attributeNode = getAstroAttribute(attributes, INFER_SIZE_ATTRIBUTE_NAME)

  return Boolean(attributeNode) && getStaticAstroAttributeValue(attributeNode) !== false
}

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require width and height for public or remote astro:assets images to avoid layout shift',
      category: 'performance',
      recommended: true,
      url: `${RULE_DOCS_BASE_URL}/require-image-dimensions`
    },
    messages: {
      publicImageDimensions:
        'Images from public/ cannot be analyzed by Astro. Add width and height to prevent layout shift.',
      remoteImageDimensions:
        'Remote images need width and height, or inferSize, so Astro can prevent layout shift.'
    },
    schema: []
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    const componentNames = getAstroImageComponentNames(context)

    return {
      Program() {
        forEachAstroElement(context, elementNode => {
          if (!elementNode.name || !componentNames.has(elementNode.name)) return

          const attributes = elementNode.attributes ?? []
          const sourceAttribute = getAstroAttribute(attributes, SOURCE_ATTRIBUTE_NAME)
          const sourceValue = getStaticAstroAttributeValue(sourceAttribute)

          if (typeof sourceValue !== 'string') return

          if (hasExplicitDimensions(attributes)) return

          if (isRemoteSource(sourceValue)) {
            if (hasSizeInference(attributes)) return

            reportAstroNode(context, elementNode, 'remoteImageDimensions')

            return
          }

          if (!sourceValue.startsWith(PUBLIC_SOURCE_PREFIX)) return

          reportAstroNode(context, elementNode, 'publicImageDimensions')
        })
      }
    }
  }
})
