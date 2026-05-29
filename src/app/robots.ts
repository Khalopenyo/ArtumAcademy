import type { MetadataRoute } from 'next';

/**
 * /robots.txt — управление индексацией поисковыми ботами.
 *
 * Закрываем:
 *   - /admin/* — админка не должна попадать в индекс
 *   - /api/* — внутренние эндпойнты
 *   - /profile, /certificates, /learn — личные страницы (приватные)
 * Открываем всё остальное (главная, каталог, курсы, юр-страницы).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://artumacademy.ru';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/profile', '/certificates', '/learn/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
