import type { CookieOptions } from 'express';
import { HR_SESSION_COOKIE, HR_SESSION_MAX_AGE_SECONDS } from '@org/shared';

/** httpOnly, SameSite=Lax, Path=/, 8 h; Secure in production (HTTPS) */
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: HR_SESSION_MAX_AGE_SECONDS * 1000,
  };
}

/** Same attributes without Max-Age, as Express needs them to clear the cookie */
export function clearSessionCookieOptions(): CookieOptions {
  const options = sessionCookieOptions();
  delete options.maxAge;
  return options;
}

/** Value of the session cookie in a raw `Cookie` header (no cookie-parser needed) */
export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === HR_SESSION_COOKIE) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value) || undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export { HR_SESSION_COOKIE };
