import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PREFIX } from '@org/shared';
import { PrismaService } from '../../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { HealthModule } from './health.module';

/** Real Nest app (global HrAuthGuard + HealthController): what only HTTP shows (azure-deploy AC-1) */
describe('Health over HTTP (azure-deploy AC-1)', () => {
  let app: INestApplication;
  let base: string;
  const queryRaw = jest.fn();
  const env = { JWT_SECRET: process.env['JWT_SECRET'], CV_STORAGE: process.env['CV_STORAGE'] };

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'health-test-'.padEnd(40, 'x');
    process.env['CV_STORAGE'] = 'local';
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, HealthModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw, user: { findFirst: jest.fn() } })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix(API_PREFIX);
    await app.listen(0);
    base = `${(await app.getUrl()).replace('[::1]', 'localhost')}/api`;
  });
  afterAll(async () => {
    await app.close();
    process.env['JWT_SECRET'] = env.JWT_SECRET;
    process.env['CV_STORAGE'] = env.CV_STORAGE;
  });
  beforeEach(() => queryRaw.mockReset());

  it('/api/health: 200 without a session or a cookie, no Set-Cookie, nothing but the status', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('/api/health/ready: 200 while the database answers, 503 (JSON) when it does not', async () => {
    queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    const up = await fetch(`${base}/health/ready`);
    expect([up.status, await up.json()]).toEqual([200, { status: 'ok', database: 'up' }]);
    expect(up.headers.get('set-cookie')).toBeNull();

    queryRaw.mockRejectedValueOnce(new Error('boom'));
    const down = await fetch(`${base}/health/ready`);
    expect([down.status, await down.json()]).toEqual([503, { status: 'error', database: 'down' }]);
  });
});
