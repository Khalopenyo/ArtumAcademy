import type { MetadataRoute } from 'next';

import { getPublishedCourses } from '@/server/queries/catalog';

/**
 * /sitemap.xml — авто-генерация для поисковых систем.
 *
 * Включает все статические маршруты + динамические /courses/[slug] из БД.
 * Next 14 рендерит это автоматически по пути app/sitemap.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://artumacademy.ru';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/subscribe`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/cases`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contacts`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/oferta`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Динамические маршруты — курсы из БД
  try {
    const courses = await getPublishedCourses();
    const courseRoutes: MetadataRoute.Sitemap = courses.map((c) => ({
      url: `${baseUrl}/courses/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
    return [...staticRoutes, ...courseRoutes];
  } catch (err) {
    // Если БД недоступна — отдаём хотя бы статичные
    console.error('[sitemap] failed to fetch courses', err);
    return staticRoutes;
  }
}
