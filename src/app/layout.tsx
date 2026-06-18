import type { Metadata, Viewport } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import { Toaster } from 'sonner';

import { CookieConsent } from '@/components/shared/CookieConsent';
import { CosmicBackground } from '@/components/shared/CosmicBackground';
import './globals.css';

// Тело — чистый гротеск Onest (кириллица-first). Заголовки — геометрический
// дисплейный Unbounded для «космического» характера. Оба — variable-шрифты,
// поэтому weight не фиксируем (грузится вся ось).
const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-display' });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://artumacademy.ru';
const SITE_NAME = 'Artum Academy';
const DEFAULT_TITLE = 'Artum Academy — онлайн-курсы по AI, фото, видео, дизайну';
const DEFAULT_DESCRIPTION =
  'Образовательная платформа с курсами по нейросетям, фотографии, видеосъёмке, монтажу, дизайну, визуалу и копирайтингу. Учитесь у профессионалов в любом темпе.';

const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  sameAs: ['https://t.me/artum_academy', 'https://vk.com/artum_academy'],
};
const SITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s · Artum Academy',
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    'онлайн-курсы',
    'нейросети',
    'AI',
    'Midjourney',
    'ChatGPT',
    'фотография',
    'видеосъёмка',
    'монтаж',
    'дизайн',
    'Figma',
    'копирайтинг',
    'обучение',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    creator: '@artum_academy',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Иконки берутся из file-convention: src/app/icon.svg + src/app/apple-icon.png
  // (Next сам генерирует <link rel="icon"> / apple-touch-icon).
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#06040F',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

/**
 * Корневой layout — тёмная космическая тема.
 * Фон отрисовывает <CosmicBackground /> (fixed inset-0 -z-10), а body
 * прозрачный, чтобы звёзды просвечивали сквозь весь интерфейс.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${onest.variable} ${unbounded.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-sans text-foreground antialiased">
        <CosmicBackground />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([ORG_JSONLD, SITE_JSONLD]) }}
        />
        {children}
        <CookieConsent />
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  );
}
