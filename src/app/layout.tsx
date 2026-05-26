import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import { CosmicBackground } from '@/components/shared/CosmicBackground';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: 'Artum Academy — онлайн-курсы по AI, фото, видео, дизайну',
    template: '%s · Artum Academy',
  },
  description:
    'Образовательная платформа с курсами по нейросетям, фотографии, видеосъёмке, монтажу, дизайну, визуалу и копирайтингу.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
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
    <html lang="ru" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen font-sans text-foreground antialiased">
        <CosmicBackground />
        {children}
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  );
}
