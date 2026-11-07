import type { Metadata } from 'next';
import { format } from '../../../i18n/format';
import { getI18n } from '../../../i18n/server';
import { getHrSession } from '../../../lib/hr-session';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hr.home.title };
}

/** /hr — the list of applications comes in Phase 3.2 (hr-auth AC-12) */
export default async function HrHomePage() {
  const [{ dict }, session] = await Promise.all([getI18n(), getHrSession()]);
  const name = session.status === 'signed-in' ? session.user.name : '';
  return (
    <section>
      <h1 className="text-2xl font-bold text-gray-900">{format(dict.hr.home.greeting, { name })}</h1>
      <p className="mt-2 text-sm text-gray-600">{dict.hr.home.intro}</p>
    </section>
  );
}
