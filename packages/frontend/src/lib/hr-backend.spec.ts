import { HrBackendError, hrBackendGet } from './hr-backend';
import { mockRequest, resetMockRequest } from '../test-utils/next-headers.mock';
import { RedirectError } from '../test-utils/next-navigation.mock';

jest.mock('next/headers', () => require('../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../test-utils/next-navigation.mock'));

describe('hrBackendGet (hr-applications AC-12, hr-auth AC-11)', () => {
  const fetchMock = jest.fn();
  const reply = (status: number, body: unknown = {}) => Promise.resolve({ ok: status < 300, status, json: async () => body });

  beforeEach(() => {
    resetMockRequest();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('forwards the session cookie, never caches, returns the JSON', async () => {
    mockRequest.hrSession = 'tok';
    fetchMock.mockReturnValue(reply(200, { ok: 1 }));
    await expect(hrBackendGet('hr/applications?tab=all')).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/hr/applications?tab=all', { headers: { Cookie: 'cvs_hr_session=tok' }, cache: 'no-store' });
  });

  it.each([
    ['SESSION_EXPIRED', '/hr/login?next=%2Fhr%2Fapplications%3Fpage%3D2&reason=expired'],
    ['UNAUTHENTICATED', '/hr/login?next=%2Fhr%2Fapplications%3Fpage%3D2'],
  ])('401 %s → the sign-in page, coming back to the page being opened', async (code, target) => {
    mockRequest.hrPath = '/hr/applications?page=2';
    fetchMock.mockReturnValue(reply(401, { code }));
    const error = await hrBackendGet('hr/applications').catch((e) => e);
    expect(error).toBeInstanceOf(RedirectError);
    expect((error as RedirectError).url).toBe(target);
  });

  it('other errors and network failures → HrBackendError with the status and code', async () => {
    fetchMock.mockReturnValueOnce(reply(404, { code: 'APPLICATION_NOT_FOUND' }));
    await expect(hrBackendGet('hr/applications/x')).rejects.toMatchObject({ status: 404, code: 'APPLICATION_NOT_FOUND' });
    fetchMock.mockReturnValueOnce(reply(500));
    await expect(hrBackendGet('x')).rejects.toBeInstanceOf(HrBackendError);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(hrBackendGet('x')).rejects.toMatchObject({ status: 0 });
  });
});
