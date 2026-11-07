import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorNotice } from '../../components/common/ErrorNotice';
import { SubmitCvForm } from '../../components/submit-cv/SubmitCvForm';
import { getI18n } from '../../i18n/server';
import { fetchOpenPositions } from '../../lib/backend';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.submit.title };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SubmitCvPage({ searchParams }: { searchParams: SearchParams }) {
  const { dict } = await getI18n();
  const requested = (await searchParams)['position'];
  const positions = await fetchOpenPositions().catch(() => null);
  // ?position=<code> from /jobs; an unknown or closed code just leaves the dropdown empty
  const initialPositionCode =
    positions?.find((p) => typeof requested === 'string' && p.code.toLowerCase() === requested.trim().toLowerCase())?.code ?? '';

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{dict.submit.title}</h1>
          <p className="mt-2 text-sm text-gray-500">{dict.submit.subtitle}</p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          {!positions ? (
            <ErrorNotice message={dict.common.loadError} />
          ) : positions.length === 0 ? (
            <div className="text-center text-sm text-gray-600">
              <p>{dict.submit.noJobs}</p>
              <Link href="/jobs" className="mt-3 inline-block font-medium text-blue-600 hover:underline">
                {dict.submit.viewJobs}
              </Link>
            </div>
          ) : (
            <SubmitCvForm positions={positions} initialPositionCode={initialPositionCode} />
          )}
        </div>
      </div>
    </div>
  );
}
