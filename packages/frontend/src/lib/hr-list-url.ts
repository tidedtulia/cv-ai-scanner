import { HR_APPLICATION_TAB_KEYS, HR_DEFAULT_APPLICATION_TAB, type HrApplicationSort, type HrApplicationTab } from '@org/shared';
import { HR_HOME } from './hr-paths';

/** State of the HR list, as it is written in the URL of /hr (hr-applications AC-10) */
export interface HrListParams {
  tab: HrApplicationTab;
  position?: string;
  category?: string;
  level?: string;
  recommendation?: string;
  q?: string;
  sort?: HrApplicationSort;
  page: number;
}

const FILTER_KEYS = ['position', 'category', 'level', 'recommendation', 'q'] as const;

export const defaultSortOf = (tab: HrApplicationTab): HrApplicationSort => (tab === 'to-decide' ? 'score' : 'newest');

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** Reads the list state from the search params of /hr; unknown values are passed on and refused by the API */
export function parseListParams(search: Record<string, string | string[] | undefined>): HrListParams {
  const tab = first(search['tab']);
  const page = Number(first(search['page']) ?? '1');
  return {
    tab: tab && (HR_APPLICATION_TAB_KEYS as string[]).includes(tab) ? (tab as HrApplicationTab) : HR_DEFAULT_APPLICATION_TAB,
    position: first(search['position']),
    category: first(search['category']),
    level: first(search['level']),
    recommendation: first(search['recommendation']),
    q: first(search['q']),
    sort: first(search['sort']) as HrApplicationSort | undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Query string of a state, without the default values (tab to-decide, its default sort, page 1) */
export function listQuery(params: HrListParams): string {
  const query = new URLSearchParams();
  if (params.tab !== HR_DEFAULT_APPLICATION_TAB) query.set('tab', params.tab);
  for (const key of FILTER_KEYS) if (params[key]) query.set(key, params[key] as string);
  if (params.sort && params.sort !== defaultSortOf(params.tab)) query.set('sort', params.sort);
  if (params.page > 1) query.set('page', String(params.page));
  return query.toString();
}

/**
 * URL of the list after a change. Changing the tab, a filter, the search or the sort goes back to page 1;
 * changing the tab also drops a sort that was only the default of the previous tab.
 */
export function listHref(current: HrListParams, change: Partial<HrListParams>): string {
  const next: HrListParams = { ...current, ...change };
  if (!('page' in change)) next.page = 1;
  if (change.tab && change.tab !== current.tab && !('sort' in change) && current.sort === defaultSortOf(current.tab)) next.sort = undefined;
  const query = listQuery(next);
  return query ? `${HR_HOME}?${query}` : HR_HOME;
}

export const hasFilters = (params: HrListParams) => FILTER_KEYS.some((key) => Boolean(params[key]));

/** Back from a detail page to the list it was opened from (`?from=<list query>`), never outside /hr */
export function backToListHref(from: string | undefined): string {
  if (!from || /[\\]|^\/|:\/\//.test(from)) return HR_HOME;
  const parsed = parseListParams(Object.fromEntries(new URLSearchParams(from)));
  const query = listQuery(parsed);
  return query ? `${HR_HOME}?${query}` : HR_HOME;
}
