import { MetadataRoute } from 'next'

const LAST_MODIFIED = new Date('2026-05-27')

const ROUTES = [
  {
    path: '/',
    changeFrequency: 'daily',
    priority: 1,
  },
  {
    path: '/features',
    changeFrequency: 'weekly',
    priority: 0.8,
  },
  {
    path: '/download',
    changeFrequency: 'weekly',
    priority: 0.8,
  },
  {
    path: '/privacy-policy',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  {
    path: '/terms',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  {
    path: '/data-delete',
    changeFrequency: 'monthly',
    priority: 0.4,
  },
  {
    path: '/login',
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    path: '/signup',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
] as const

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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl()

  return ROUTES.map((route) => ({
    url: route.path === '/' ? `${baseUrl}/` : `${baseUrl}${route.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
