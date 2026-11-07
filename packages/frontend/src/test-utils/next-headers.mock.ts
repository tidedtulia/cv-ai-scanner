/**
 * Stand-in for `next/headers` in Jest: the request the Server Components see.
 * Use with: jest.mock('next/headers', () => require('<path>/test-utils/next-headers.mock'));
 */
export const mockRequest: { cookieLocale?: string; acceptLanguage: string | null } = { acceptLanguage: null };

export function resetMockRequest() {
  mockRequest.cookieLocale = undefined;
  mockRequest.acceptLanguage = null;
}

export async function cookies() {
  return {
    get: (name: string) => (name === 'locale' && mockRequest.cookieLocale ? { name, value: mockRequest.cookieLocale } : undefined),
  };
}

export async function headers() {
  return {
    get: (name: string) => (name.toLowerCase() === 'accept-language' ? mockRequest.acceptLanguage : null),
  };
}
