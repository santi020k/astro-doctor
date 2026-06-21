import { forEachAstroElement, reportAstroNode } from '../utils/astro-ast.js'
import { getAstroAttributeValue, hasAstroAttribute } from '../utils/attribute.js'
import { createRule, isAstroFile } from '../utils/rule.js'

const IMAGE_COMPONENT_NAMES = new Set(['Image', 'Picture'])
const SOURCE_ATTRIBUTE_NAME = 'src'
const WIDTH_ATTRIBUTE_NAME = 'width'
const HEIGHT_ATTRIBUTE_NAME = 'height'
const INFER_SIZE_ATTRIBUTE_NAME = 'inferSize'
const REMOTE_SOURCE_PREFIXES = ['https://', 'http://', '//']
const PUBLIC_SOURCE_PREFIX = '/'

const isRemoteSource = (sourceValue: string): boolean =>
  REMOTE_SOURCE_PREFIXES.some((sourcePrefix) => sourceValue.startsWith(sourcePrefix))

const hasExplicitDimensions = (attributeNames: readonly string[]): boolean =>
  attributeNames.includes(WIDTH_ATTRIBUTE_NAME) && attributeNames.includes(HEIGHT_ATTRIBUTE_NAME)

export default createRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require width and height for public or remote astro:assets images to avoid layout shift',
      category: 'performance',
      recommended: true,
      url: 'https://github.com/santi020k/astro-doctor/blob/main/docs/rules/require-image-dimensions.md',
    },
    messages: {
      publicImageDimensions:
        'Images from public/ cannot be analyzed by Astro. Add width and height to prevent layout shift.',
      remoteImageDimensions:
        'Remote images need width and height, or inferSize, so Astro can prevent layout shift.',
    },
    schema: [],
  },
  create(context) {
    if (!isAstroFile(context.filename)) return {}

    return {
      Program() {
        forEachAstroElement(context, (elementNode) => {
          if (!elementNode.name || !IMAGE_COMPONENT_NAMES.has(elementNode.name)) return

          const attributes = elementNode.attributes ?? []
          const sourceValue = getAstroAttributeValue(attributes, SOURCE_ATTRIBUTE_NAME)

          if (sourceValue === undefined) return

          const attributeNames = attributes
            .map((attributeNode) => attributeNode.name)
            .filter((attributeName): attributeName is string => attributeName !== undefined)

          if (hasExplicitDimensions(attributeNames)) return

          if (isRemoteSource(sourceValue)) {
            if (hasAstroAttribute(attributes, INFER_SIZE_ATTRIBUTE_NAME)) return

            reportAstroNode(context, elementNode, 'remoteImageDimensions')

            return
          }

          if (!sourceValue.startsWith(PUBLIC_SOURCE_PREFIX)) return

          reportAstroNode(context, elementNode, 'publicImageDimensions')
        })
      },
    }
  },
})
