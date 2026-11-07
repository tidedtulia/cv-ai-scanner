import { SiteFooter } from '../../components/layout/SiteFooter';
import { SiteHeader } from '../../components/layout/SiteHeader';
import { getI18n } from '../../i18n/server';

/** Header + footer of the public pages (/, /jobs, /submit-cv, /privacy). The route group does not change the URLs. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { dict } = await getI18n();
  return (
    <>
      <SiteHeader dict={dict} />
      <main className="flex-1">{children}</main>
      <SiteFooter dict={dict} />
    </>
  );
}
