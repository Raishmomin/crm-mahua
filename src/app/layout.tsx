import type { Metadata } from 'next';
import './globals.css';
import { LABELS } from '@/lib/labels';

export const metadata: Metadata = {
  title: `${LABELS.appName} - ${LABELS.tagline}`,
  description: 'Production B2B CRM for Dehydrated Onion Manufacturers and Exporters in India',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
