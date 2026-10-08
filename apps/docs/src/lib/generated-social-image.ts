import { getRouteManifestImage, type OgRouteManifest } from '@santi020k/og'

import routeManifest from '../../public/og/manifest.json'

// Metadata uses the primary WebP card, including its full-generation content version.
const manifest: OgRouteManifest = {
  generatorVersion: routeManifest.generatorVersion,
  routes: Object.fromEntries(Object.entries(routeManifest.routes).map(([pathname, route]) => [pathname, {
    ...route,
    images: route.images.filter(image => image.format === 'webp').map(image => ({
      ...image,
      format: 'webp' as const
    }))
  }])),
  version: 1
}

export const getGeneratedSocialImagePath = (pathname: string): string | undefined => getRouteManifestImage(manifest, pathname, { format: 'webp' })?.url

export const getOgImagePath = (pathname: string): string => {
  const clean = pathname.replaceAll(/^\/|\/$/g, '') || 'index'

  return getGeneratedSocialImagePath(pathname) ?? `/og/${clean}.webp`
}
