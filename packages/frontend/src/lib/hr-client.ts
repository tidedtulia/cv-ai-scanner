import { loginUrl } from './hr-paths';

/** Thrown by hrFetch after it started the redirect to the login page */
export class HrSessionExpiredError extends Error {
  constructor() {
    super('HR session expired');
  }
}

/** How hrFetch leaves the page; replaced in tests (jsdom does not let window.location.assign be mocked) */
export const hrNavigation = { assign: (url: string) => window.location.assign(url) };

/**
 * fetch() for the HR API (/api/hr/*) from the browser: a 401 (session expired, account deactivated) sends the
 * HR to the login page, coming back to the current page afterwards, instead of showing a raw error (hr-auth AC-13).
 */
export async function hrFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { credentials: 'same-origin', ...init });
  if (response.status === 401) {
    hrNavigation.assign(loginUrl(`${window.location.pathname}${window.location.search}`, true));
    throw new HrSessionExpiredError();
  }
  return response;
}

export interface HrApiResult<T = unknown> {
  ok: boolean;
  status: number;
  /** Parsed JSON body (the data on success, `{ code, message, … }` on an error); {} when there is none */
  body: T & { code?: string; applicationCount?: number };
}

/** JSON call to the HR API from the browser: sends JSON, parses the answer; a 401 goes to the sign-in page (hrFetch) */
export async function hrRequest<T = unknown>(method: string, url: string, data?: unknown): Promise<HrApiResult<T>> {
  const response = await hrFetch(url, {
    method,
    ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  });
  const body = (await response.json().catch(() => ({}))) as HrApiResult<T>['body'];
  return { ok: response.ok, status: response.status, body };
}
