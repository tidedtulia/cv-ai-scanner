import {
  API_PREFIX,
  API_ROUTES,
  type IJobCategory,
  type IJobLevel,
  type IPublicPositionSummary,
} from '@org/shared';

/**
 * Backend origin for Server Components. The browser never calls it directly: it calls `/api/*`
 * on the frontend's own origin, which next.config.js rewrites to the same BACKEND_URL (FQ3).
 */
export const BACKEND_URL = process.env['BACKEND_URL'] || 'http://localhost:3001';

export class BackendError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`Backend ${path} responded ${status}`);
  }
}

async function getJson<T>(path: string): Promise<T> {
  // Job lists change when HR opens / closes a job — always read fresh data
  const res = await fetch(`${BACKEND_URL}/${API_PREFIX}/${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new BackendError(res.status, path);
  }
  return (await res.json()) as T;
}

export interface PositionFilters {
  category?: string;
  level?: string;
}

export function fetchOpenPositions(filters: PositionFilters = {}): Promise<IPublicPositionSummary[]> {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.level) params.set('level', filters.level);
  const query = params.toString();
  return getJson(query ? `${API_ROUTES.POSITIONS}?${query}` : API_ROUTES.POSITIONS);
}

export const fetchJobCategories = () => getJson<IJobCategory[]>(API_ROUTES.JOB_CATEGORIES);

export const fetchJobLevels = () => getJson<IJobLevel[]>(API_ROUTES.JOB_LEVELS);
