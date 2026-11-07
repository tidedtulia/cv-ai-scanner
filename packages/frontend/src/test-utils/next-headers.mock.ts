/**
 * Stand-in for `next/headers` in Jest: the request the Server Components see.
 * Use with: jest.mock('next/headers', () => require('<path>/test-utils/next-headers.mock'));
 */
export const mockRequest: {
  cookieLocale?: string;
  acceptLanguage: string | null;
  /** value of the HR session cookie (cvs_hr_session) */
  hrSession?: string;
  /** path set by src/proxy.ts in the x-hr-path request header */
  hrPath?: string;
} = { acceptLanguage: null };

export function resetMockRequest() {
  mockRequest.cookieLocale = undefined;
  mockRequest.acceptLanguage = null;
  mockRequest.hrSession = undefined;
  mockRequest.hrPath = undefined;
}

export async function cookies() {
  return {
    get: (name: string) => {
      if (name === 'locale' && mockRequest.cookieLocale) return { name, value: mockRequest.cookieLocale };
      if (name === 'cvs_hr_session' && mockRequest.hrSession) return { name, value: mockRequest.hrSession };
      return undefined;
    },
  };
}

export async function headers() {
  return {
    get: (name: string) => {
      const key = name.toLowerCase();
      if (key === 'accept-language') return mockRequest.acceptLanguage;
      if (key === 'x-hr-path') return mockRequest.hrPath ?? null;
      return null;
    },
  };
}
