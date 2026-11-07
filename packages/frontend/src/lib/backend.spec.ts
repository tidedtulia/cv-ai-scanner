import { BackendError, fetchJobCategories, fetchJobLevels, fetchOpenPositions } from './backend';

describe('backend (server-side API calls; AC-4, AC-6)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = fetchMock;
  });

  it('fetchOpenPositions() calls the backend without cache, with only the filters given', async () => {
    await fetchOpenPositions();
    await fetchOpenPositions({ category: 'DEVELOPER', level: 'SENIOR' });
    await fetchOpenPositions({ level: 'MIDDLE' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3001/api/positions',
      'http://localhost:3001/api/positions?category=DEVELOPER&level=SENIOR',
      'http://localhost:3001/api/positions?level=MIDDLE',
    ]);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { cache: 'no-store' });
  });

  it('fetchJobCategories() / fetchJobLevels() call their endpoints', async () => {
    await fetchJobCategories();
    await fetchJobLevels();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3001/api/job-categories',
      'http://localhost:3001/api/job-levels',
    ]);
  });

  it('throws BackendError with the status when the backend fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    const error = await fetchOpenPositions().catch((e) => e);
    expect(error).toBeInstanceOf(BackendError);
    expect(error.status).toBe(503);
  });
});
