import type { MetadataRoute } from 'next'

import { getConfiguredAppOrigin } from '@/lib/utils/url'

const LAST_MODIFIED = new Date('2026-05-27')

const ROUTES = [
  {
    path: '/',
    changeFrequency: 'daily',
    priority: 1,
  },
  {
    path: '/download',
    changeFrequency: 'weekly',
    priority: 0.8,
  },
  {
    path: '/blog',
    changeFrequency: 'weekly',
    priority: 0.7,
  },
  {
    path: '/contact',
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    path: '/privacy-policy',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  {
    path: '/security',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  {
    path: '/report-issue',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  {
    path: '/terms',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getConfiguredAppOrigin()

  return ROUTES.map((route) => ({
    url: route.path === '/' ? `${baseUrl}/` : `${baseUrl}${route.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
