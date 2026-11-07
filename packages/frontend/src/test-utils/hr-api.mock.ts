/**
 * Stand-in for `lib/hr-backend` in Jest: the HR API answers the Server Components get.
 * Use with: jest.mock('<path>/lib/hr-backend', () => require('<path>/test-utils/hr-api.mock'));
 */
export class HrBackendError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`HR API responded ${status}`);
  }
}

export const hrApi: { calls: string[]; handler: (path: string) => unknown } = { calls: [], handler: () => new HrBackendError(0) };

export function resetHrApi() {
  hrApi.calls = [];
  hrApi.handler = () => new HrBackendError(0);
}

export async function hrBackendGet(path: string) {
  hrApi.calls.push(path);
  const answer = hrApi.handler(path);
  if (answer instanceof HrBackendError) throw answer;
  return answer;
}
