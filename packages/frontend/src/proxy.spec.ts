/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

describe('proxy of the HR area (hr-auth AC-9, AC-11, AC-12)', () => {
  it('only runs for /hr and /hr/*', () => {
    expect(config.matcher).toEqual(['/hr', '/hr/:path*']);
  });

  it.each([
    ['/hr', 'http://localhost:3000/hr/login'],
    ['/hr/applications?status=EVALUATED', 'http://localhost:3000/hr/login?next=%2Fhr%2Fapplications%3Fstatus%3DEVALUATED'],
  ])('no session cookie: %s → %s', (path, location) => {
    const response = proxy(request(path));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(location);
  });

  it('an empty session cookie counts as no cookie', () => {
    expect(proxy(request('/hr', 'cvs_hr_session=')).headers.get('location')).toBe('http://localhost:3000/hr/login');
  });

  it('the sign-in page is reachable without a session', () => {
    const response = proxy(request('/hr/login?next=%2Fhr'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-hr-path')).toBe('/hr/login?next=%2Fhr');
  });

  it('with a cookie: passes the path to the layouts (the cookie itself is checked there, with the backend)', () => {
    const response = proxy(request('/hr/applications?page=2', 'locale=vi; cvs_hr_session=abc.def.ghi'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-hr-path')).toBe('/hr/applications?page=2');
  });

  it.each([['/hr'], ['/hr/login']])('HR responses are never cached nor indexed (%s)', (path) => {
    for (const response of [proxy(request(path)), proxy(request(path, 'cvs_hr_session=abc'))]) {
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    }
  });
});
