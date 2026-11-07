import type { Metadata } from 'next';
import Link from 'next/link';
import { POSITION_STATUSES, type IHrPositionListItem, type PositionStatus } from '@org/shared';
import { ErrorNotice } from '../../../../components/common/ErrorNotice';
import { PositionStatusBadge } from '../../../../components/hr/PositionStatusBadge';
import { formatDate } from '../../../../i18n/format-date';
import { getI18n } from '../../../../i18n/server';
import { HrBackendError, hrBackendGet } from '../../../../lib/hr-backend';

type SearchParams = Promise<{ status?: string | string[] }>;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hrPositions.title };
}

/** /hr/positions — every job with its counts; filter by status through links (hr-positions AC-13) */
export default async function HrPositionsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).status;
  const wanted = (Array.isArray(raw) ? raw[0] : raw) as PositionStatus | undefined;
  const status = wanted && POSITION_STATUSES.includes(wanted) ? wanted : undefined;
  const { dict } = await getI18n();
  const t = dict.hrPositions;

  let all: IHrPositionListItem[];
  try {
    all = await hrBackendGet<IHrPositionListItem[]>('hr/positions');
  } catch (error) {
    if (!(error instanceof HrBackendError)) throw error;
    return <ErrorNotice message={t.loadError} />;
  }
  const shown = status ? all.filter((job) => job.status === status) : all;
  const count = (s?: PositionStatus) => (s ? all.filter((job) => job.status === s).length : all.length);
  const filters: { key: PositionStatus | undefined; label: string }[] = [{ key: undefined, label: t.list.all }, ...POSITION_STATUSES.map((s) => ({ key: s, label: t.status[s] }))];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <Link href="/hr/positions/new" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          {t.list.create}
        </Link>
      </div>

      <nav aria-label={t.list.filterLabel} className="flex flex-wrap gap-2 border-b border-gray-200">
        {filters.map(({ key, label }) => (
          <Link
            key={key ?? 'all'}
            href={key ? `/hr/positions?status=${key}` : '/hr/positions'}
            aria-current={key === status ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${key === status ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {label} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{count(key)}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">{t.list.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
              <tr>
                {(['job', 'code', 'categoryLevel', 'status', 'criteria', 'applications', 'updated'] as const).map((column) => (
                  <th key={column} scope="col" className="px-4 py-2">
                    {t.list.columns[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/hr/positions/${job.id}`} className="font-medium text-blue-700 hover:underline">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{job.code}</td>
                  <td className="px-4 py-2">
                    {job.category.name} · {job.level.name}
                  </td>
                  <td className="px-4 py-2">
                    <PositionStatusBadge status={job.status} dict={dict} />
                  </td>
                  <td className="px-4 py-2">{job.criteriaCount}</td>
                  <td className="px-4 py-2">
                    <Link href={`/hr?tab=all&position=${encodeURIComponent(job.code)}`} className="text-blue-700 hover:underline">
                      {job.applicationCount}
                    </Link>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(job.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
