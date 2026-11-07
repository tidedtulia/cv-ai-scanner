import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_PREFIX, HR_SESSION_COOKIE } from '@org/shared';
import { BACKEND_URL } from './backend';
import { HR_HOME, HR_PATH_HEADER, loginUrl } from './hr-paths';

/** Error answer of the HR API (other than 401, which redirects to the sign-in page) */
export class HrBackendError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`HR API responded ${status}${code ? ` ${code}` : ''}`);
  }
}

/**
 * GET on the HR API (/api/hr/*) from a Server Component, forwarding the session cookie of the request.
 * 401 → /hr/login?next=<this page> (hr-auth AC-11); other errors → HrBackendError (hr-applications AC-12).
 */
export async function hrBackendGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(HR_SESSION_COOKIE)?.value;
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/${API_PREFIX}/${path}`, {
      headers: token ? { Cookie: `${HR_SESSION_COOKIE}=${token}` } : {},
      cache: 'no-store',
    });
  } catch {
    throw new HrBackendError(0);
  }
  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => ({}))) as { code?: string };
  if (response.status === 401) {
    const path = (await headers()).get(HR_PATH_HEADER) ?? HR_HOME;
    redirect(loginUrl(path, body.code === 'SESSION_EXPIRED'));
  }
  throw new HrBackendError(response.status, body.code);
}
