import { HttpException, Logger } from '@nestjs/common';
import { HEALTH_DB_TIMEOUT_MS, HealthController } from './health.controller';

/** azure-deploy AC-1 */
describe('HealthController (azure-deploy AC-1)', () => {
  const queryRaw = jest.fn();
  let controller: HealthController;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    queryRaw.mockReset();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    controller = new HealthController({ $queryRaw: queryRaw } as never);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('live: ok, and it never touches the database', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('ready: database answers → ok / up', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.ready()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('ready: database fails → 503 error / down, the reason only in the log (no host, no connection string)', async () => {
    queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.1.2.3:5432 postgres://user:secret@db.example.com/app'));
    const error = (await controller.ready().catch((e) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toEqual({ status: 'error', database: 'down' });
    expect(JSON.stringify(error.getResponse())).not.toMatch(/secret|10\.1\.2\.3|postgres:/);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it(`ready: no answer within ${HEALTH_DB_TIMEOUT_MS} ms → 503 down`, async () => {
    jest.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));
    const result = controller.ready().catch((e) => e);
    await jest.advanceTimersByTimeAsync(HEALTH_DB_TIMEOUT_MS + 1);
    const error = (await result) as HttpException;
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toEqual({ status: 'error', database: 'down' });
  });
});
