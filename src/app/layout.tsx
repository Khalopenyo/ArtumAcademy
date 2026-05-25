import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
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
  themeColor: '#0D0D0F',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

/**
 * Корневой layout — тёмная тема по умолчанию (single mode на этапе скелета).
 * Палитра — ТЗ §2: #0D0D0F фон, #A855F7 акцент.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  );
}
