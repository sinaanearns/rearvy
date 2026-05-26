import { MetadataRoute } from 'next'

function getBaseUrl() {
  const fallbackUrl = 'https://www.rearvy.com'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || fallbackUrl

  try {
    const url = new URL(appUrl)
    if (url.hostname === 'rearvy.com') {
      url.hostname = 'www.rearvy.com'
    }

    return url.origin
  } catch {
    return fallbackUrl
  }
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
