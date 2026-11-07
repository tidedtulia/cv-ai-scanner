import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import type { Metadata } from 'next';
import PublicLayout from '../app/(public)/layout';
import RootLayout, { generateMetadata as layoutMetadata } from '../app/layout';
import { I18nProvider } from '../i18n/I18nProvider';
import { getI18n } from '../i18n/server';

/**
 * Renders a Server Component page the way the root layout wraps it (I18nProvider with the
 * locale resolved from the mocked request). Requires `next/headers` to be mocked.
 */
export async function renderPage(page: ReactElement | Promise<ReactElement>) {
  const { locale } = await getI18n();
  const ui = await page;
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>);
}

/**
 * Renders the real root layout + public layout around `children` (header, main, footer), as Next.js nests them.
 * <html> / <body> can't be mounted inside the test container, so the body's content is rendered
 * and the <html lang> is returned for assertions.
 */
export async function renderLayout(children: ReactNode) {
  const html = (await RootLayout({ children: await PublicLayout({ children }) })) as ReactElement<{ lang: string; children: ReactElement<{ children: ReactNode }> }>;
  const body = html.props.children;
  return { lang: html.props.lang, ...render(<>{body.props.children}</>) };
}

/** Browser tab title = page title in the layout's template, as Next.js composes it. */
export async function pageTitle(pageMetadata?: () => Promise<Metadata>): Promise<string> {
  const layout = (await layoutMetadata()).title as { default: string; template: string };
  const page = pageMetadata ? (await pageMetadata()).title : undefined;
  return typeof page === 'string' ? layout.template.replace('%s', page) : layout.default;
}
