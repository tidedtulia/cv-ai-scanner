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
