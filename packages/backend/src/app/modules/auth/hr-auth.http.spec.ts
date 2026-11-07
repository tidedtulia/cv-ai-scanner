import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { API_PREFIX } from '@org/shared';
import { AppController } from '../../app.controller';
import { AppService } from '../../app.service';
import { hashPassword } from '../../common/password';
import { PrismaService } from '../../database/prisma.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from './auth.module';

/**
 * Real Nest app (AuthModule + its global guard + UsersModule) over HTTP, the database replaced by an in-memory
 * `users` table: cookie attributes, status codes, rate limit, /api/hr/* protection (hr-auth AC-1 → AC-8).
 */
const SECRET = 'test-secret-'.padEnd(40, 'x');
const ADMIN_ID = '0b6a3a39-7f3e-4ad7-9a4b-8f9e2d1c0a11';
const OTHER_ID = '7c1e8e7a-2f6b-4c1d-9d1e-3b2a1f0e9d22';

interface Row { id: string; name: string; email: string; passwordHash: string; isActive: boolean; createdAt: Date; updatedAt: Date }
const pick = (row: Row | undefined, select?: Record<string, boolean>) =>
  row && (select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k as keyof Row]])) : { ...row });
const known = (code: string) => new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: 'test' });

class FakePrisma {
  rows: Row[] = [];
  user = {
    findUnique: async ({ where, select }: { where: { id?: string; email?: string }; select?: Record<string, boolean> }) =>
      pick(this.rows.find((r) => (where.id ? r.id === where.id : r.email === where.email)), select) ?? null,
    findFirst: async ({ where, select }: { where: { id: string; isActive: boolean }; select?: Record<string, boolean> }) =>
      pick(this.rows.find((r) => r.id === where.id && r.isActive === where.isActive), select) ?? null,
    findMany: async ({ select }: { select?: Record<string, boolean> }) => this.rows.map((r) => pick(r, select)),
    create: async ({ data, select }: { data: Omit<Row, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>; select?: Record<string, boolean> }) => {
      if (this.rows.some((r) => r.email === data.email)) throw known('P2002');
      const row: Row = { id: `9${String(this.rows.length).padStart(7, '0')}-0000-4000-8000-000000000000`, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.rows.push(row);
      return pick(row, select);
    },
    update: async ({ where, data, select }: { where: { id: string }; data: Partial<Row>; select?: Record<string, boolean> }) => {
      const row = this.rows.find((r) => r.id === where.id);
      if (!row) throw known('P2025');
      if (data.email && this.rows.some((r) => r.email === data.email && r.id !== row.id)) throw known('P2002');
      Object.assign(row, data);
      return pick(row, select);
    },
    delete: async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
      const index = this.rows.findIndex((r) => r.id === where.id);
      if (index < 0) throw known('P2025');
      return pick(this.rows.splice(index, 1)[0], select);
    },
  };
}

describe('HR auth over HTTP (hr-auth)', () => {
  let app: INestApplication;
  let base: string;
  const prisma = new FakePrisma();
  const previousSecret = process.env['JWT_SECRET'];

  beforeAll(async () => {
    process.env['JWT_SECRET'] = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AuthModule, UsersModule], controllers: [AppController], providers: [AppService] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    (app as NestExpressApplication).set('trust proxy', 'loopback, linklocal, uniquelocal');
    app.setGlobalPrefix(API_PREFIX);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost').replace('::1', 'localhost');
  });

  afterAll(async () => {
    await app.close();
    process.env['JWT_SECRET'] = previousSecret;
  });

  beforeEach(async () => {
    prisma.rows = [
      { id: ADMIN_ID, name: 'HR Admin', email: 'hr@example.com', passwordHash: await hashPassword('Correct-horse-1'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: OTHER_ID, name: 'Other HR', email: 'other@example.com', passwordHash: await hashPassword('Other-horse-1'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ];
  });

  let ipCounter = 1;
  /** Each test logs in from its own IP (X-Forwarded-For) so the rate limit of one test does not leak into another */
  const freshIp = () => `10.0.0.${ipCounter++}`;
  const json = (body: unknown, extra: Record<string, string> = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
  const login = (email: string, password: string, ip = freshIp()) => fetch(`${base}/api/auth/login`, json({ email, password }, { 'X-Forwarded-For': ip }));
  const cookieOf = (response: Response) => response.headers.get('set-cookie') ?? '';
  const sessionFrom = (response: Response) => cookieOf(response).split(';')[0]; // "cvs_hr_session=<jwt>"
  const signIn = async () => sessionFrom(await login('hr@example.com', 'Correct-horse-1'));
  const get = (path: string, cookie?: string) => fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {} });

  describe('POST /api/auth/login', () => {
    it('AC-1: 200 + the user; the JWT only in an HttpOnly, SameSite=Lax, 8-hour cookie', async () => {
      const response = await login(' HR@Example.com ', 'Correct-horse-1');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ user: { id: ADMIN_ID, name: 'HR Admin', email: 'hr@example.com' } });
      const cookie = cookieOf(response);
      expect(cookie).toMatch(/^cvs_hr_session=[\w-]+\.[\w-]+\.[\w-]+;/);
      expect(cookie).toMatch(/Max-Age=28800/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).not.toMatch(/Secure/); // not in development
      expect(JSON.stringify(body)).not.toContain(cookie.split(';')[0].split('=')[1]);
    });

    it('AC-1: the cookie is Secure in production', async () => {
      const env = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      const response = await login('hr@example.com', 'Correct-horse-1');
      process.env['NODE_ENV'] = env;
      expect(cookieOf(response)).toMatch(/Secure/);
    });

    it.each([
      ['wrong password', 'hr@example.com', 'wrong-password'],
      ['unknown email', 'nobody@example.com', 'Correct-horse-1'],
    ])('AC-2: %s → 401 INVALID_CREDENTIALS, no cookie', async (_case, email, password) => {
      const response = await login(email, password);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
      expect(cookieOf(response)).toBe('');
    });

    it('AC-3: invalid body → 400 with a code; a non-JSON body → 415', async () => {
      const missing = await fetch(`${base}/api/auth/login`, json({ password: 'x' }, { 'X-Forwarded-For': freshIp() }));
      expect(missing.status).toBe(400);
      expect(await missing.json()).toMatchObject({ code: 'EMAIL_INVALID' });
      const form = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=hr%40example.com&password=Correct-horse-1' });
      expect(form.status).toBe(415);
      expect(cookieOf(form)).toBe('');
    });

    it('AC-4: 5 failures → the 6th try is 429 with Retry-After, even with the right password; another IP still works', async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) expect((await login('hr@example.com', 'wrong-password', ip)).status).toBe(401);
      const blocked = await login('hr@example.com', 'Correct-horse-1', ip);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('retry-after')).toBe('900');
      expect(await blocked.json()).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
      expect((await login('hr@example.com', 'Correct-horse-1', freshIp())).status).toBe(200);
    });
  });

  describe('session', () => {
    it('AC-5: GET /api/auth/me with the cookie → the user; logout → 204 + cookie cleared', async () => {
      const session = await signIn();
      const me = await get('/api/auth/me', session);
      expect(me.status).toBe(200);
      expect(await me.json()).toEqual({ user: { id: ADMIN_ID, name: 'HR Admin', email: 'hr@example.com' } });
      const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: session } });
      expect(logout.status).toBe(204);
      expect(cookieOf(logout)).toMatch(/^cvs_hr_session=;.*Expires=Thu, 01 Jan 1970/);
      expect((await get('/api/auth/me')).status).toBe(401);
      expect((await fetch(`${base}/api/auth/logout`, { method: 'POST' })).status).toBe(204); // not signed in: still 204
    });

    it('AC-6: /api/hr/* without a valid session → 401 with a code', async () => {
      const valid = await new JwtService({ secret: SECRET }).signAsync({ sub: ADMIN_ID });
      const expired = await new JwtService({ secret: SECRET }).signAsync({ sub: ADMIN_ID, exp: Math.floor(Date.now() / 1000) - 5 });
      const otherKey = await new JwtService({ secret: 'k'.repeat(40) }).signAsync({ sub: ADMIN_ID });
      const cases: [string, string | undefined, string][] = [
        ['no cookie', undefined, 'UNAUTHENTICATED'],
        ['garbage token', 'cvs_hr_session=abc.def.ghi', 'UNAUTHENTICATED'],
        ['tampered token', `cvs_hr_session=${valid.slice(0, -2)}xx`, 'UNAUTHENTICATED'],
        ['signed with another secret', `cvs_hr_session=${otherKey}`, 'UNAUTHENTICATED'],
        ['expired token', `cvs_hr_session=${expired}`, 'SESSION_EXPIRED'],
      ];
      for (const [label, cookie, code] of cases) {
        const response = await get('/api/hr/users', cookie);
        const body = (await response.json()) as { code: string };
        expect({ label, status: response.status, code: body.code }).toEqual({ label, status: 401, code });
      }
      expect((await get('/api/hr/users', `cvs_hr_session=${valid}`)).status).toBe(200);
    });

    it('AC-6: an account deactivated during the session is signed out at the next request', async () => {
      const session = await signIn();
      expect((await get('/api/hr/users', session)).status).toBe(200);
      prisma.rows[0].isActive = false;
      const response = await get('/api/hr/users', session);
      expect(response.status).toBe(401);
      expect(cookieOf(response)).toMatch(/^cvs_hr_session=;/);
    });

    it('AC-6: public routes need no session', async () => {
      expect((await get('/api')).status).toBe(200);
    });
  });

  describe('/api/hr/users (AC-8)', () => {
    it('the old /api/users is gone', async () => {
      expect((await get('/api/users')).status).toBe(404);
      expect((await fetch(`${base}/api/users`, json({ name: 'x', email: 'x@y.co', password: 'longenough' }))).status).toBe(404);
    });

    it('lists and creates accounts, never returning passwordHash', async () => {
      const session = await signIn();
      const list = await (await get('/api/hr/users', session)).json();
      expect(list).toHaveLength(2);
      expect(JSON.stringify(list)).not.toMatch(/passwordHash|scrypt/);
      const created = await fetch(`${base}/api/hr/users`, json({ name: 'New HR', email: 'New@Example.com', password: 'longenough' }, { Cookie: session }));
      expect(created.status).toBe(201);
      const body = await created.json();
      expect(body).toMatchObject({ name: 'New HR', email: 'new@example.com', isActive: true });
      expect(body).not.toHaveProperty('passwordHash');
      expect((await login('new@example.com', 'longenough')).status).toBe(200); // the new account can sign in
    });

    it('duplicate email → 409, invalid body → 400, non-JSON write → 415, bad id → 400 / 404', async () => {
      const session = await signIn();
      const duplicate = await fetch(`${base}/api/hr/users`, json({ name: 'Dup', email: 'OTHER@example.com', password: 'longenough' }, { Cookie: session }));
      expect(duplicate.status).toBe(409);
      expect(await duplicate.json()).toMatchObject({ code: 'EMAIL_TAKEN' });
      const short = await fetch(`${base}/api/hr/users`, json({ name: 'A', email: 'a@b.co', password: 'short' }, { Cookie: session }));
      expect(await short.json()).toMatchObject({ statusCode: 400, code: 'PASSWORD_LENGTH' });
      const text = await fetch(`${base}/api/hr/users`, { method: 'POST', headers: { Cookie: session, 'Content-Type': 'text/plain' }, body: 'name=A' });
      expect(text.status).toBe(415);
      expect((await get('/api/hr/users/not-a-uuid', session)).status).toBe(400);
      expect((await get('/api/hr/users/3d9f1b2a-1111-4222-8333-444455556666', session)).status).toBe(404);
    });

    it('an HR cannot delete or deactivate their own account, but can manage others', async () => {
      const session = await signIn();
      const selfDelete = await fetch(`${base}/api/hr/users/${ADMIN_ID}`, { method: 'DELETE', headers: { Cookie: session } });
      expect(selfDelete.status).toBe(400);
      expect(await selfDelete.json()).toMatchObject({ code: 'CANNOT_CHANGE_OWN_ACCOUNT' });
      const selfDeactivate = await fetch(`${base}/api/hr/users/${ADMIN_ID}`, { ...json({ isActive: false }, { Cookie: session }), method: 'PATCH' });
      expect(selfDeactivate.status).toBe(400);
      const other = await fetch(`${base}/api/hr/users/${OTHER_ID}`, { ...json({ isActive: false }, { Cookie: session }), method: 'PATCH' });
      expect(other.status).toBe(200);
      expect((await login('other@example.com', 'Other-horse-1')).status).toBe(401); // deactivated → cannot sign in
      expect((await fetch(`${base}/api/hr/users/${OTHER_ID}`, { method: 'DELETE', headers: { Cookie: session } })).status).toBe(200);
    });
  });
});
