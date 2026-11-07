import type { Metadata } from 'next';
import './global.css';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SiteHeader } from '../components/layout/SiteHeader';
import { I18nProvider } from '../i18n/I18nProvider';
import { getI18n } from '../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return {
    title: { default: dict.meta.siteName, template: `%s · ${dict.meta.siteName}` },
    description: dict.meta.description,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale, dict } = await getI18n();

  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) inject attributes into <html>/<body>
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
        <I18nProvider locale={locale}>
          <SiteHeader dict={dict} />
          <main className="flex-1">{children}</main>
          <SiteFooter dict={dict} />
        </I18nProvider>
      </body>
    </html>
  );
}
