import type { Metadata } from 'next';
import Link from 'next/link';
import type { IHrApplicationFilters, IHrApplicationListResponse } from '@org/shared';
import { HR_APPLICATION_TAB_KEYS } from '@org/shared';
import { ErrorNotice } from '../../../components/common/ErrorNotice';
import { RecommendationBadge, StatusBadge } from '../../../components/hr/StatusBadges';
import { format } from '../../../i18n/format';
import { formatDate, formatScore } from '../../../i18n/format-date';
import { getI18n } from '../../../i18n/server';
import { HrBackendError, hrBackendGet } from '../../../lib/hr-backend';
import { defaultSortOf, hasFilters, listHref, listQuery, parseListParams } from '../../../lib/hr-list-url';
import { HR_HOME } from '../../../lib/hr-paths';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.hrApplications.title };
}

const select = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm';

/** /hr — applications of the HR: tabs, filters in the URL, rows, pages (hr-applications AC-9 → AC-12) */
export default async function HrApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseListParams(await searchParams);
  const { dict } = await getI18n();
  const t = dict.hrApplications;

  let list: IHrApplicationListResponse;
  let filters: IHrApplicationFilters;
  try {
    const query = new URLSearchParams();
    query.set('tab', params.tab);
    for (const key of ['position', 'category', 'level', 'recommendation', 'q', 'sort'] as const) if (params[key]) query.set(key, params[key] as string);
    if (params.page > 1) query.set('page', String(params.page));
    [list, filters] = await Promise.all([
      hrBackendGet<IHrApplicationListResponse>(`hr/applications?${query.toString()}`),
      hrBackendGet<IHrApplicationFilters>('hr/application-filters'),
    ]);
  } catch (error) {
    if (!(error instanceof HrBackendError)) throw error;
    return <ErrorNotice message={t.loadError} />;
  }

  const sort = params.sort ?? defaultSortOf(params.tab);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const from = listQuery(params);
  const filtered = hasFilters(params);
  const suffix = (status: string, labels: { draft: string; closed: string }) => (status === 'DRAFT' ? ` ${labels.draft}` : status === 'CLOSED' ? ` ${labels.closed}` : '');

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>

      <nav aria-label={t.title} className="flex flex-wrap gap-2 border-b border-gray-200">
        {HR_APPLICATION_TAB_KEYS.map((tab) => (
          <Link
            key={tab}
            href={listHref(params, { tab })}
            aria-current={tab === params.tab ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === params.tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {t.tabs[tab]} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{list.counts[tab]}</span>
          </Link>
        ))}
      </nav>

      <form method="get" action={HR_HOME} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="tab" value={params.tab} />
        <label className="text-sm font-medium text-gray-700 lg:col-span-2">
          {t.filters.search}
          <input type="search" name="q" defaultValue={params.q ?? ''} maxLength={255} className={select} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t.filters.position}
          <select name="position" defaultValue={params.position ?? ''} className={select}>
            <option value="">{t.filters.all}</option>
            {filters.positions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.title}
                {suffix(p.status, t.filters)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t.filters.category}
          <select name="category" defaultValue={params.category ?? ''} className={select}>
            <option value="">{t.filters.all}</option>
            {filters.categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.isActive ? '' : ` ${t.filters.inactive}`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t.filters.level}
          <select name="level" defaultValue={params.level ?? ''} className={select}>
            <option value="">{t.filters.all}</option>
            {filters.levels.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
                {l.isActive ? '' : ` ${t.filters.inactive}`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t.filters.recommendation}
          <select name="recommendation" defaultValue={params.recommendation ?? ''} className={select}>
            <option value="">{t.filters.all}</option>
            {(['RECOMMENDED', 'CONSIDER', 'NOT_RECOMMENDED'] as const).map((value) => (
              <option key={value} value={value}>
                {t.recommendation[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          {t.filters.sort}
          <select name="sort" defaultValue={sort} className={select}>
            <option value="score">{t.filters.sortScore}</option>
            <option value="newest">{t.filters.sortNewest}</option>
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {t.filters.searchButton}
          </button>
          {filtered && (
            <Link href={listHref(params, { position: undefined, category: undefined, level: undefined, recommendation: undefined, q: undefined })} className="text-sm text-blue-700 hover:underline">
              {t.filters.reset}
            </Link>
          )}
        </div>
      </form>

      {list.items.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">{filtered ? t.noMatch : t.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-2">{t.table.candidate}</th>
                <th scope="col" className="px-4 py-2">{t.table.position}</th>
                <th scope="col" className="px-4 py-2">{t.table.submitted}</th>
                <th scope="col" className="px-4 py-2">{t.table.status}</th>
                <th scope="col" className="px-4 py-2">{t.table.score}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/hr/applications/${item.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`} className="font-medium text-blue-700 hover:underline">
                      {item.fullName}
                    </Link>
                    <div className="text-xs text-gray-500">{item.email}</div>
                  </td>
                  <td className="px-4 py-2">{item.position.title}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-2"><StatusBadge status={item.status} dict={dict} /></td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {item.overallScore === null || item.recommendation === null ? (
                      t.noScore
                    ) : (
                      <span className="flex items-center gap-2">
                        <strong>{formatScore(item.overallScore)}</strong>
                        <RecommendationBadge value={item.recommendation} dict={dict} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t.pagination.label} className="flex items-center justify-between text-sm">
          {params.page > 1 ? <Link href={listHref(params, { page: params.page - 1 })} className="text-blue-700 hover:underline">{t.pagination.previous}</Link> : <span />}
          <span className="text-gray-600">{format(t.pagination.page, { page: list.page, pages })}</span>
          {params.page < pages ? <Link href={listHref(params, { page: params.page + 1 })} className="text-blue-700 hover:underline">{t.pagination.next}</Link> : <span />}
        </nav>
      )}
    </section>
  );
}
