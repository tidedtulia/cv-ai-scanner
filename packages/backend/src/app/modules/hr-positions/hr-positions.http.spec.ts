import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { API_PREFIX } from '@org/shared';
import { apiException } from '../../common/api-error';
import { PrismaService } from '../../database/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { HrCatalogService } from './hr-catalog.service';
import { HrCriteriaService } from './hr-criteria.service';
import { HrPositionsModule } from './hr-positions.module';
import { HrPositionsService } from './hr-positions.service';

/**
 * Real Nest app (global HrAuthGuard + the controllers), the services mocked: what only HTTP shows —
 * 401 / 415, status codes of creates and deletes, the JSON error bodies, route + id wiring (hr-positions AC-1 → AC-11).
 */
const SECRET = 'hr-positions-test-'.padEnd(40, 'x');
const HR = { id: '0b6a3a39-7f3e-4ad7-9a4b-8f9e2d1c0a11', name: 'HR Admin', email: 'hr@example.com' };
const POS = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
const CRIT = '7a1b2c3d-0000-4000-8000-000000000001';
const CAT = '9b8a7c6d-0000-4000-8000-000000000001';

describe('HR positions over HTTP (hr-positions)', () => {
  let app: INestApplication;
  let base: string;
  let session: string;
  const positions = { list: jest.fn(), create: jest.fn(), detail: jest.fn(), update: jest.fn(), remove: jest.fn(), setStatus: jest.fn() };
  const criteria = { add: jest.fn(), update: jest.fn(), remove: jest.fn(), move: jest.fn() };
  const catalog = { list: jest.fn(), create: jest.fn(), update: jest.fn() };
  const env = { JWT_SECRET: process.env['JWT_SECRET'], CV_STORAGE: process.env['CV_STORAGE'] };

  beforeAll(async () => {
    process.env['JWT_SECRET'] = SECRET;
    const prisma = { user: { findFirst: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === HR.id ? HR : null)) } };
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, HrPositionsModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(HrPositionsService).useValue(positions)
      .overrideProvider(HrCriteriaService).useValue(criteria)
      .overrideProvider(HrCatalogService).useValue(catalog)
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
    positions.list.mockResolvedValue([]);
    positions.create.mockResolvedValue({ id: POS });
    positions.detail.mockResolvedValue({ id: POS });
    positions.update.mockResolvedValue({ id: POS });
    positions.remove.mockResolvedValue({ deleted: true });
    positions.setStatus.mockResolvedValue({ id: POS, status: 'OPEN' });
    criteria.add.mockResolvedValue({ id: POS });
    criteria.update.mockResolvedValue({ id: POS });
    criteria.remove.mockResolvedValue({ id: POS });
    criteria.move.mockResolvedValue({ id: POS });
    catalog.list.mockResolvedValue([]);
    catalog.create.mockResolvedValue({ id: CAT });
    catalog.update.mockResolvedValue({ id: CAT });
  });

  const send = (method: string, path: string, body?: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }, cookie: string | null = session) =>
    fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : headers) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });

  const ROUTES: [string, string, unknown?][] = [
    ['GET', '/hr/positions'],
    ['POST', '/hr/positions', {}],
    ['GET', `/hr/positions/${POS}`],
    ['PATCH', `/hr/positions/${POS}`, {}],
    ['DELETE', `/hr/positions/${POS}`],
    ['POST', `/hr/positions/${POS}/status`, {}],
    ['POST', `/hr/positions/${POS}/criteria`, {}],
    ['PATCH', `/hr/positions/${POS}/criteria/${CRIT}`, {}],
    ['DELETE', `/hr/positions/${POS}/criteria/${CRIT}`],
    ['POST', `/hr/positions/${POS}/criteria/${CRIT}/move`, {}],
    ['GET', '/hr/job-categories'],
    ['POST', '/hr/job-categories', {}],
    ['PATCH', `/hr/job-categories/${CAT}`, {}],
    ['GET', '/hr/job-levels'],
    ['POST', '/hr/job-levels', {}],
    ['PATCH', `/hr/job-levels/${CAT}`, {}],
  ];

  it('every route needs a session → 401, nothing reaches the services', async () => {
    for (const [method, path, body] of ROUTES) {
      const response = await send(method, path, body, undefined, null);
      expect({ method, path, status: response.status }).toEqual({ method, path, status: 401 });
    }
    expect(positions.create).not.toHaveBeenCalled();
    expect(catalog.create).not.toHaveBeenCalled();
  });

  it('every write that is not JSON (a form of another site) → 415', async () => {
    for (const [method, path] of ROUTES.filter(([m]) => m !== 'GET' && m !== 'DELETE')) {
      const response = await send(method, path, 'name=x', { 'Content-Type': 'application/x-www-form-urlencoded' });
      expect({ method, path, status: response.status }).toEqual({ method, path, status: 415 });
    }
    expect(criteria.add).not.toHaveBeenCalled();
  });

  it('AC-1: the query string reaches the service', async () => {
    await send('GET', '/hr/positions?status=OPEN');
    expect(positions.list).toHaveBeenCalledWith({ status: 'OPEN' });
  });

  it('AC-2: create → 201 with the body; a JSON error of the service keeps its code and extra fields', async () => {
    const created = await send('POST', '/hr/positions', { title: 'x' });
    expect(created.status).toBe(201);
    expect(positions.create).toHaveBeenCalledWith({ title: 'x' });
    positions.create.mockRejectedValueOnce(apiException(409, 'CODE_TAKEN', 'taken'));
    const taken = await send('POST', '/hr/positions', { title: 'x', code: 'a-b' });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ statusCode: 409, error: 'Conflict', code: 'CODE_TAKEN' });
  });

  it('AC-3 / AC-4: ids are checked as uuid; update and detail reach the service', async () => {
    expect((await send('GET', '/hr/positions/not-a-uuid')).status).toBe(400);
    expect((await send('PATCH', '/hr/positions/not-a-uuid', {})).status).toBe(400);
    expect((await send('GET', `/hr/positions/${POS}/criteria/nope`)).status).toBe(404);
    await send('PATCH', `/hr/positions/${POS}`, { title: 'New' });
    expect(positions.update).toHaveBeenCalledWith(POS, { title: 'New' });
    expect(positions.detail).not.toHaveBeenCalled();
  });

  it('AC-5: the status route answers 200 (not 201)', async () => {
    const response = await send('POST', `/hr/positions/${POS}/status`, { status: 'OPEN' });
    expect(response.status).toBe(200);
    expect(positions.setStatus).toHaveBeenCalledWith(POS, { status: 'OPEN' });
  });

  it('AC-6: delete → 200; a 409 with applicationCount keeps its body', async () => {
    expect((await send('DELETE', `/hr/positions/${POS}`)).status).toBe(200);
    positions.remove.mockRejectedValueOnce(apiException(409, 'POSITION_HAS_APPLICATIONS', 'x', { applicationCount: 3 }));
    const response = await send('DELETE', `/hr/positions/${POS}`);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'POSITION_HAS_APPLICATIONS', applicationCount: 3 });
  });

  it('AC-7 / AC-8: criteria routes carry both ids; move answers 200', async () => {
    expect((await send('POST', `/hr/positions/${POS}/criteria`, { name: 'A' })).status).toBe(201);
    await send('PATCH', `/hr/positions/${POS}/criteria/${CRIT}`, { weight: 4 });
    await send('DELETE', `/hr/positions/${POS}/criteria/${CRIT}`);
    const moved = await send('POST', `/hr/positions/${POS}/criteria/${CRIT}/move`, { direction: 'up' });
    expect(moved.status).toBe(200);
    expect(criteria.add).toHaveBeenCalledWith(POS, { name: 'A' });
    expect(criteria.update).toHaveBeenCalledWith(POS, CRIT, { weight: 4 });
    expect(criteria.remove).toHaveBeenCalledWith(POS, CRIT);
    expect(criteria.move).toHaveBeenCalledWith(POS, CRIT, { direction: 'up' });
  });

  it('AC-9 → AC-11: categories and levels use the right catalog kind', async () => {
    await send('GET', '/hr/job-categories');
    await send('GET', '/hr/job-levels');
    expect(catalog.list.mock.calls.map((c) => c[0])).toEqual(['category', 'level']);
    expect((await send('POST', '/hr/job-levels', { name: 'Lead' })).status).toBe(201);
    expect(catalog.create).toHaveBeenCalledWith('level', { name: 'Lead' });
    await send('PATCH', `/hr/job-categories/${CAT}`, { isActive: false });
    expect(catalog.update).toHaveBeenCalledWith('category', CAT, { isActive: false });
    expect((await send('DELETE', `/hr/job-categories/${CAT}`)).status).toBe(404); // nothing is ever deleted
  });
});
