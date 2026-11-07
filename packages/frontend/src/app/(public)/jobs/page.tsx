import type { Metadata } from 'next';
import Link from 'next/link';
import { ErrorNotice } from '../../components/common/ErrorNotice';
import { JobCard } from '../../components/jobs/JobCard';
import { JobFilters, type JobFilterValues } from '../../components/jobs/JobFilters';
import { getI18n } from '../../i18n/server';
import { fetchJobCategories, fetchJobLevels, fetchOpenPositions } from '../../lib/backend';

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.jobs.title };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const single = (value: string | string[] | undefined) => (typeof value === 'string' && value.trim()) || undefined;

function loadJobs(filters: JobFilterValues) {
  return Promise.all([fetchOpenPositions(filters), fetchJobCategories(), fetchJobLevels()])
    .then(([positions, categories, levels]) => ({ positions, categories, levels }))
    .catch(() => null);
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const { dict } = await getI18n();
  const params = await searchParams;
  const filters: JobFilterValues = { category: single(params['category']), level: single(params['level']) };
  const data = await loadJobs(filters);
  const isFiltered = Boolean(filters.category || filters.level);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">{dict.jobs.title}</h1>
      <p className="mt-1 text-sm text-gray-500">{dict.jobs.subtitle}</p>

      {!data ? (
        <div className="mt-8">
          <ErrorNotice message={dict.common.loadError} />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <JobFilters categories={data.categories} levels={data.levels} selected={filters} />
          </div>
          {data.positions.length === 0 ? (
            <div className="mt-8 rounded-xl bg-white p-8 text-center text-sm text-gray-600 ring-1 ring-gray-200">
              <p>{isFiltered ? dict.jobs.noMatch : dict.jobs.noJobs}</p>
              {isFiltered && (
                <Link href="/jobs" className="mt-3 inline-block font-medium text-blue-600 hover:underline">
                  {dict.jobs.clearFilters}
                </Link>
              )}
            </div>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {data.positions.map((position) => (
                <li key={position.code}>
                  <JobCard position={position} dict={dict.jobs} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
