/** Paths of the HR area, shared by the proxy, the Server Components and the browser (hr-auth AC-10, AC-11). */
export const HR_HOME = '/hr';
export const HR_LOGIN = '/hr/login';
/** Request header set by src/proxy.ts with the path being opened, so layouts know where to come back to */
export const HR_PATH_HEADER = 'x-hr-path';
/** `?reason=` value that makes the login page say the session expired */
export const EXPIRED_REASON = 'expired';

const BASE = 'http://hr.invalid';

const isHrPath = (pathname: string) => pathname === HR_HOME || pathname.startsWith(`${HR_HOME}/`);
const isLoginPath = (pathname: string) => pathname === HR_LOGIN || pathname.startsWith(`${HR_LOGIN}/`);

/**
 * Where to go after signing in: only a path of the HR area on this site (`/hr`, `/hr/...`), never `//evil`,
 * `https://evil`, `/\evil` or the login page itself; anything else falls back to `/hr`.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return HR_HOME;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return HR_HOME;
  }
  if (url.origin !== BASE || !isHrPath(url.pathname) || isLoginPath(url.pathname)) return HR_HOME;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** /hr/login?next=<path>[&reason=expired]; `next` is only added when it is not the default */
export function loginUrl(next?: string, expired = false): string {
  const params = new URLSearchParams();
  const target = safeNextPath(next);
  if (target !== HR_HOME) params.set('next', target);
  if (expired) params.set('reason', EXPIRED_REASON);
  const query = params.toString();
  return query ? `${HR_LOGIN}?${query}` : HR_LOGIN;
}

export { isHrPath, isLoginPath };
