'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IHrSessionUser } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { clientApi } from '../../lib/client-api';
import { HR_HOME, HR_LOGIN } from '../../lib/hr-paths';

/** Menu of the HR area; a page is current for its own path and the ones below it (applications: also /hr/applications/...) */
const MENU = [
  { key: 'applications', href: HR_HOME, match: (path: string) => path === HR_HOME || path.startsWith('/hr/applications') },
  { key: 'positions', href: '/hr/positions', match: (path: string) => path.startsWith('/hr/positions') },
  { key: 'catalog', href: '/hr/catalog', match: (path: string) => path.startsWith('/hr/catalog') },
] as const;
import { LanguageSwitcher } from '../layout/LanguageSwitcher';

/** Header of the HR area: project name + "HR", the signed-in HR and Sign out (only when signed in), VI | EN (hr-auth AC-12). */
export function HrHeader({ user }: { user?: IHrSessionUser }) {
  const { dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch(clientApi.authLogout, { method: 'POST', credentials: 'same-origin' });
    } catch {
      // the cookie may stay if the backend is down; the protected pages still check it on the next request
    }
    router.replace(HR_LOGIN);
    router.refresh();
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl 2xl:max-w-[90rem] min-[1920px]:max-w-[110rem] items-center justify-between gap-4 px-4 py-3">
        <Link href={HR_HOME} className="flex items-center gap-2 text-base font-bold text-gray-900">
          {dict.meta.siteName}
          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{dict.hr.areaName}</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {user && (
            <nav aria-label={dict.hrNav.label} className="flex items-center gap-4 font-medium">
              {MENU.map((item) => (
                <Link key={item.key} href={item.href} aria-current={item.match(pathname) ? 'page' : undefined} className={item.match(pathname) ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900'}>
                  {dict.hrNav[item.key]}
                </Link>
              ))}
            </nav>
          )}
          {user && (
            <>
              <span data-testid="hr-user">{format(dict.hr.header.signedInAs, { name: user.name })}</span>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="rounded-md border border-gray-300 px-3 py-1 font-medium hover:bg-gray-100 disabled:opacity-60"
              >
                {loggingOut ? dict.hr.header.loggingOut : dict.hr.header.logout}
              </button>
            </>
          )}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
