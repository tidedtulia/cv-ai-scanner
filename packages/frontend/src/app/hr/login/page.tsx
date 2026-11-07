import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HrHeader } from '../../../components/hr/HrHeader';
import { HrLoginForm } from '../../../components/hr/HrLoginForm';
import { getI18n } from '../../../i18n/server';
import { EXPIRED_REASON, safeNextPath } from '../../../lib/hr-paths';
import { getHrSession } from '../../../lib/hr-session';

type SearchParams = Promise<{ next?: string | string[]; reason?: string | string[] }>;
const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hr.login.title };
}

/** /hr/login — already signed in → straight to `next` (hr-auth AC-9 → AC-11) */
export default async function HrLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const session = await getHrSession();
  if (session.status === 'signed-in') redirect(next);

  const { dict } = await getI18n();
  return (
    <>
      <HrHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">{dict.hr.login.heading}</h1>
          <p className="mb-5 mt-1 text-sm text-gray-500">{dict.hr.login.intro}</p>
          <HrLoginForm next={next} expired={first(params.reason) === EXPIRED_REASON} />
        </div>
      </main>
    </>
  );
}
