import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { API_PREFIX } from '@org/shared';
import { apiException } from '../../common/api-error';
import { PrismaService } from '../../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { HrApplicationsModule } from './hr-applications.module';
import { HrApplicationsService } from './hr-applications.service';
import { inlineDisposition } from './hr-applications.controller';

/**
 * Real Nest app (global HrAuthGuard + HrApplicationsController), the service mocked:
 * what only HTTP shows — PDF headers, 401 / 415 / 400, the signed-in HR passed to the actions (hr-applications AC-5 → AC-8).
 */
const SECRET = 'hr-applications-test-'.padEnd(40, 'x');
const HR = { id: '0b6a3a39-7f3e-4ad7-9a4b-8f9e2d1c0a11', name: 'HR Admin', email: 'hr@example.com' };
const APP_ID = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';

describe('HR applications over HTTP (hr-applications)', () => {
  let app: INestApplication;
  let base: string;
  let session: string;
  const service = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    filters: jest.fn().mockResolvedValue({ positions: [], categories: [], levels: [] }),
    detail: jest.fn().mockResolvedValue({ id: APP_ID }),
    cv: jest.fn(),
    decide: jest.fn().mockResolvedValue({ id: APP_ID, status: 'ACCEPTED' }),
    reEvaluate: jest.fn().mockResolvedValue({ id: APP_ID, status: 'SUBMITTED' }),
  };
  const env = { JWT_SECRET: process.env['JWT_SECRET'], CV_STORAGE: process.env['CV_STORAGE'] };

  beforeAll(async () => {
    process.env['JWT_SECRET'] = SECRET;
    process.env['CV_STORAGE'] = 'local';
    const prisma = { user: { findFirst: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === HR.id ? HR : null)) } };
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, HrApplicationsModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(HrApplicationsService)
      .useValue(service)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix(API_PREFIX);
    await app.listen(0);
    base = `${(await app.getUrl()).replace('[::1]', 'localhost')}/api`;
    session = `cvs_hr_session=${await new JwtService({ secret: SECRET }).signAsync({ sub: HR.id })}`;
  });

  afterAll(async () => {
    await app.close();
    process.env['JWT_SECRET'] = env.JWT_SECRET;
    process.env['CV_STORAGE'] = env.CV_STORAGE;
  });

  beforeEach(() => jest.clearAllMocks());

  /** cookie null = no session */
  const get = (path: string, cookie: string | null = session) => fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
  const post = (path: string, body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
    fetch(base + path, { method: 'POST', headers: { Cookie: session, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('AC-8: every route needs a session (401 UNAUTHENTICATED)', async () => {
    for (const path of ['/hr/applications', '/hr/application-filters', `/hr/applications/${APP_ID}`, `/hr/applications/${APP_ID}/cv`]) {
      const response = await get(path, null);
      expect({ path, status: response.status, code: ((await response.json()) as { code: string }).code }).toEqual({ path, status: 401, code: 'UNAUTHENTICATED' });
    }
    const write = await fetch(`${base}/hr/applications/${APP_ID}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(write.status).toBe(401);
    expect(service.decide).not.toHaveBeenCalled();
  });

  it('AC-1 / AC-2: the query string reaches the service as is (repeated parameters stay arrays → 400 there)', async () => {
    await get('/hr/applications?tab=all&q=nguy%E1%BB%85n&page=2&tab=pending');
    expect(service.list).toHaveBeenCalledWith({ tab: ['all', 'pending'], q: 'nguyễn', page: '2' });
  });

  it('AC-4: a non-uuid id → 400 before the service', async () => {
    expect((await get('/hr/applications/not-a-uuid')).status).toBe(400);
    expect((await get('/hr/applications/not-a-uuid/cv')).status).toBe(400);
    expect(service.detail).not.toHaveBeenCalled();
  });

  it('AC-5: the CV is sent inline as a PDF, uncached, nosniff, with the Vietnamese file name', async () => {
    const bytes = Buffer.from('%PDF-1.7 ÿ\u0000 binary');
    service.cv.mockResolvedValue({ content: bytes, fileName: 'CV Nguyễn Văn A.pdf' });
    const response = await get(`/hr/applications/${APP_ID}/cv`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe(`inline; filename="CV Nguyen Van A.pdf"; filename*=UTF-8''CV%20Nguy%E1%BB%85n%20V%C4%83n%20A.pdf`);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });

  it('AC-5: a storage error from the service keeps its JSON error body', async () => {
    service.cv.mockRejectedValue(apiException(502, 'CV_UNAVAILABLE', 'The CV cannot be loaded right now'));
    const response = await get(`/hr/applications/${APP_ID}/cv`);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'CV_UNAVAILABLE' });
  });

  it('AC-6 / AC-7: the actions get the signed-in HR id and answer 200 with the detail', async () => {
    const decided = await post(`/hr/applications/${APP_ID}/decision`, { decision: 'ACCEPTED', note: 'ok' });
    expect(decided.status).toBe(200);
    expect(await decided.json()).toEqual({ id: APP_ID, status: 'ACCEPTED' });
    expect(service.decide).toHaveBeenCalledWith(APP_ID, { decision: 'ACCEPTED', note: 'ok' }, HR.id);

    const reEvaluated = await post(`/hr/applications/${APP_ID}/re-evaluate`, {});
    expect(reEvaluated.status).toBe(200);
    expect(service.reEvaluate).toHaveBeenCalledWith(APP_ID, HR.id);
  });

  it('AC-8: a write that is not JSON (e.g. a form of another site) → 415, the service is not called', async () => {
    const form = await post(`/hr/applications/${APP_ID}/decision`, 'decision=ACCEPTED', { 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(form.status).toBe(415);
    const text = await post(`/hr/applications/${APP_ID}/re-evaluate`, 'x', { 'Content-Type': 'text/plain' });
    expect(text.status).toBe(415);
    expect(service.decide).not.toHaveBeenCalled();
    expect(service.reEvaluate).not.toHaveBeenCalled();
  });

  it('AC-6: a 409 from the service keeps currentStatus in the body', async () => {
    service.decide.mockRejectedValueOnce(apiException(409, 'STATUS_NOT_ALLOWED', 'x', { currentStatus: 'ACCEPTED' }));
    const response = await post(`/hr/applications/${APP_ID}/decision`, { decision: 'REJECTED' });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'STATUS_NOT_ALLOWED', currentStatus: 'ACCEPTED' });
  });
});

describe('inlineDisposition (hr-applications AC-5)', () => {
  it.each([
    ['cv.pdf', `inline; filename="cv.pdf"; filename*=UTF-8''cv.pdf`],
    ['Hồ sơ "Đức".pdf', `inline; filename="Ho so _Đuc_.pdf"`.replace('Đ', '_') + `; filename*=UTF-8''H%E1%BB%93%20s%C6%A1%20%22%C4%90%E1%BB%A9c%22.pdf`],
  ])('%s', (name, expected) => {
    expect(inlineDisposition(name)).toBe(expected);
  });
});
