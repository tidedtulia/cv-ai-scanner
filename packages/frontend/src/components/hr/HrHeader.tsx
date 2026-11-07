'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IHrSessionUser } from '@org/shared';
import { format } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nProvider';
import { clientApi } from '../../lib/client-api';
import { HR_HOME, HR_LOGIN } from '../../lib/hr-paths';
import { LanguageSwitcher } from '../layout/LanguageSwitcher';

/** Header of the HR area: project name + "HR", the signed-in HR and Sign out (only when signed in), VI | EN (hr-auth AC-12). */
export function HrHeader({ user }: { user?: IHrSessionUser }) {
  const { dict } = useI18n();
  const router = useRouter();
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={HR_HOME} className="flex items-center gap-2 text-base font-bold text-gray-900">
          {dict.meta.siteName}
          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{dict.hr.areaName}</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-600">
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
