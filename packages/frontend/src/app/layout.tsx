import type { Metadata } from 'next';
import './global.css';
import { I18nProvider } from '../i18n/I18nProvider';
import { getI18n } from '../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return {
    title: { default: dict.meta.siteName, template: `%s · ${dict.meta.siteName}` },
    description: dict.meta.description,
  };
}

/**
 * Root layout: <html lang>, <body> and the i18n context only. The public pages get their header / footer
 * from app/(public)/layout.tsx, the HR area its own from app/hr/layout.tsx (hr-auth AC-12).
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = await getI18n();

  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) inject attributes into <html>/<body>
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
