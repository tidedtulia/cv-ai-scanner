import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErrorNotice } from '../../../components/common/ErrorNotice';
import { HrHeader } from '../../../components/hr/HrHeader';
import { getI18n } from '../../../i18n/server';
import { HR_HOME, HR_PATH_HEADER, loginUrl } from '../../../lib/hr-paths';
import { getHrSession } from '../../../lib/hr-session';

/**
 * Every HR page except /hr/login: the session is checked with the backend on each request (no cache).
 * Not signed in / expired / deactivated → /hr/login?next=<this page> (hr-auth AC-11, AC-12).
 * The backend checks the cookie again on every /api/hr/* call, so data is never served without a session.
 */
export default async function HrProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getHrSession();
  if (session.status === 'signed-out') {
    const path = (await headers()).get(HR_PATH_HEADER) ?? HR_HOME;
    redirect(loginUrl(path, session.reason === 'expired'));
  }

  if (session.status === 'unavailable') {
    const { dict } = await getI18n();
    return (
      <>
        <HrHeader />
        <main className="mx-auto w-full max-w-6xl 2xl:max-w-[90rem] flex-1 px-4 py-8">
          <ErrorNotice message={dict.hr.loadError} />
        </main>
      </>
    );
  }

  return (
    <>
      <HrHeader user={session.user} />
      <main className="mx-auto w-full max-w-6xl 2xl:max-w-[90rem] flex-1 px-4 py-8">{children}</main>
    </>
  );
}
