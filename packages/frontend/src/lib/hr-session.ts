import { cookies } from 'next/headers';
import { API_PREFIX, API_ROUTES, HR_SESSION_COOKIE, type IHrSessionResponse, type IHrSessionUser } from '@org/shared';
import { BACKEND_URL } from './backend';

export type HrSession =
  | { status: 'signed-in'; user: IHrSessionUser }
  /** missing: no cookie · expired: older than 8 h · invalid: bad token, account gone or deactivated */
  | { status: 'signed-out'; reason: 'missing' | 'expired' | 'invalid' }
  /** The backend could not be reached / answered with a server error */
  | { status: 'unavailable' };

/**
 * The HR behind the session cookie of the current request, asked to the backend (GET /api/auth/me), which checks
 * the signature, the 8-hour expiry and that the account is still active (hr-auth AC-6, AC-11).
 */
export async function getHrSession(): Promise<HrSession> {
  const token = (await cookies()).get(HR_SESSION_COOKIE)?.value;
  if (!token) return { status: 'signed-out', reason: 'missing' };

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/${API_PREFIX}/${API_ROUTES.AUTH_ME}`, {
      headers: { Cookie: `${HR_SESSION_COOKIE}=${token}` },
      cache: 'no-store',
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (response.ok) return { status: 'signed-in', user: ((await response.json()) as IHrSessionResponse).user };
  if (response.status === 401) {
    const body = (await response.json().catch(() => ({}))) as { code?: string };
    return { status: 'signed-out', reason: body.code === 'SESSION_EXPIRED' ? 'expired' : 'invalid' };
  }
  return { status: 'unavailable' };
}
