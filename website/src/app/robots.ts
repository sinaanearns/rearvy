import type { MetadataRoute } from 'next'

import { getConfiguredAppOrigin } from '@/lib/utils/url'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getConfiguredAppOrigin()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
