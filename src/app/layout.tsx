import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Gujarati } from 'next/font/google';
import './globals.css';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';

const gujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  weight: ['400', '600', '700'],
  variable: '--font-gujarati',
  display: 'swap',
});

export const metadata: Metadata = {
  title: t('en', 'app.name'),
  description: t('en', 'app.tagline'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} className={gujarati.variable}>
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
