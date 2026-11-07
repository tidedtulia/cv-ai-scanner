/**
 * Fake backend for the HR tests: routes global.fetch for GET /api/auth/me (server side, called by getHrSession)
 * and POST /api/auth/login / logout (browser side). Install with `installHrBackend()` in beforeEach.
 */
export interface FakeResponse {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
}

export const answer = (status: number, body: unknown = {}, headers: Record<string, string> = {}): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

export const HR_USER = { id: '0b6a3a39-7f3e-4ad7-9a4b-8f9e2d1c0a11', name: 'HR Admin', email: 'hr@example.com' };

export const hrBackend: {
  /** What GET /api/auth/me answers for the cookie the request carries */
  session: 'valid' | 'expired' | 'invalid' | 'down';
  user: typeof HR_USER;
  /** What POST /api/auth/login answers */
  login: () => Promise<FakeResponse>;
  fetch: jest.Mock;
} = { session: 'valid', user: HR_USER, login: async () => answer(200, { user: HR_USER }), fetch: jest.fn() };

const AUTH_ME = 'http://localhost:3001/api/auth/me';

function route(url: string): Promise<FakeResponse> {
  if (url === AUTH_ME) {
    if (hrBackend.session === 'down') return Promise.reject(new TypeError('fetch failed'));
    if (hrBackend.session === 'valid') return Promise.resolve(answer(200, { user: hrBackend.user }));
    return Promise.resolve(answer(401, { statusCode: 401, code: hrBackend.session === 'expired' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED' }));
  }
  if (url === '/api/auth/login') return hrBackend.login();
  if (url === '/api/auth/logout') return Promise.resolve(answer(204));
  return Promise.reject(new Error(`unexpected fetch ${url}`));
}

export function installHrBackend() {
  hrBackend.session = 'valid';
  hrBackend.user = HR_USER;
  hrBackend.login = async () => answer(200, { user: HR_USER });
  hrBackend.fetch = jest.fn((url: string) => route(url));
  global.fetch = hrBackend.fetch as unknown as typeof fetch;
}

/** Calls made to one URL: [url, init] */
export const callsTo = (url: string) => hrBackend.fetch.mock.calls.filter(([called]) => called === url);
