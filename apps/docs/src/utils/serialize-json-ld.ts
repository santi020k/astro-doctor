export const serializeJsonLd = (value: object): string => JSON.stringify(value).replaceAll('<', '\\u003c')
