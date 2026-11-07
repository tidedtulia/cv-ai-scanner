import { NextResponse, type NextRequest } from 'next/server';
import { HR_SESSION_COOKIE } from '@org/shared';
import { HR_LOGIN, HR_PATH_HEADER, isLoginPath } from './lib/hr-paths';

/**
 * Next.js proxy (formerly "middleware") for the HR area only:
 * - no session cookie → /hr/login?next=<path> before any page renders (hr-auth AC-11);
 * - passes the path to the layouts (HR_PATH_HEADER), which check the cookie with the backend;
 * - HR pages are never cached (Back after sign-out does not show them) nor indexed (AC-9, AC-12).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = `${pathname}${search}`;

  let response: NextResponse;
  if (!isLoginPath(pathname) && !request.cookies.get(HR_SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = HR_LOGIN;
    url.search = '';
    if (path !== '/hr') url.searchParams.set('next', path);
    response = NextResponse.redirect(url);
  } else {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(HR_PATH_HEADER, path);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = { matcher: ['/hr', '/hr/:path*'] };
