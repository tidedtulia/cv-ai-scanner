/**
 * Stand-in for `next/navigation` in Jest.
 * Use with: jest.mock('next/navigation', () => require('<path>/test-utils/next-navigation.mock'));
 */
export const mockRouter = { push: jest.fn(), refresh: jest.fn() };

export const useRouter = () => mockRouter;

export function resetMockRouter() {
  mockRouter.push.mockReset();
  mockRouter.refresh.mockReset();
}
