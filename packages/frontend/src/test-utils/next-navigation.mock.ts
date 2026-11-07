/**
 * Stand-in for `next/navigation` in Jest.
 * Use with: jest.mock('next/navigation', () => require('<path>/test-utils/next-navigation.mock'));
 */
export const mockRouter = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn() };

export const useRouter = () => mockRouter;

export function resetMockRouter() {
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.refresh.mockReset();
}

/** Thrown by the mocked redirect(), like Next.js stops rendering with NEXT_REDIRECT */
export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

export function redirect(url: string): never {
  throw new RedirectError(url);
}

/** Awaits a Server Component that is expected to redirect; returns the target URL */
export async function redirectTarget(render: () => Promise<unknown>): Promise<string> {
  try {
    await render();
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  throw new Error('expected a redirect');
}
