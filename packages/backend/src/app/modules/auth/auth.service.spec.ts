import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_MESSAGES } from '@org/shared';
import { hashPassword } from '../../common/password';
import { AuthRepository } from './auth.repository';
import { AuthService, LoginBlockedError } from './auth.service';
import { LoginAttemptsService } from './login-attempts.service';

const SECRET = 's'.repeat(32);

describe('AuthService (hr-auth AC-1 → AC-4, AC-6)', () => {
  let service: AuthService;
  let repo: { findForLogin: jest.Mock; findActiveSessionUser: jest.Mock };
  let attempts: LoginAttemptsService;
  const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: 8 * 3600 } });
  let account: { id: string; name: string; email: string; passwordHash: string; isActive: boolean };

  beforeAll(async () => {
    account = { id: '0b6a3a39-7f3e-4ad7-9a4b-8f9e2d1c0a11', name: 'HR Admin', email: 'hr@example.com', passwordHash: await hashPassword('Correct-horse-1'), isActive: true };
  });

  beforeEach(async () => {
    repo = { findForLogin: jest.fn(async (email: string) => (email === account.email ? { ...account } : null)), findActiveSessionUser: jest.fn() };
    attempts = new LoginAttemptsService();
    service = new AuthService(repo as unknown as AuthRepository, jwt, attempts);
    await service.onModuleInit();
  });

  const codeOf = (error: unknown) => ((error as HttpException).getResponse() as { code: string }).code;
  const statusOf = (error: unknown) => (error as HttpException).getStatus();

  it('AC-1: trims / lowercases the email and returns the user + a signed token (sub = user id)', async () => {
    const { user, token } = await service.login({ email: '  HR@Example.com ', password: 'Correct-horse-1' }, '1.1.1.1');
    expect(user).toEqual({ id: account.id, name: 'HR Admin', email: 'hr@example.com' });
    expect(user).not.toHaveProperty('passwordHash');
    expect(repo.findForLogin).toHaveBeenCalledWith('hr@example.com');
    expect((await jwt.verifyAsync(token)).sub).toBe(account.id);
  });

  it.each([
    ['unknown email', { email: 'nobody@example.com', password: 'Correct-horse-1' }],
    ['wrong password', { email: 'hr@example.com', password: 'wrong-password' }],
  ])('AC-2: %s → 401 INVALID_CREDENTIALS with the same message', async (_case, body) => {
    const error = await service.login(body, '1.1.1.1').catch((e) => e);
    expect(statusOf(error)).toBe(401);
    expect((error as HttpException).getResponse()).toEqual({ statusCode: 401, error: 'Unauthorized', code: 'INVALID_CREDENTIALS', message: AUTH_MESSAGES.INVALID_CREDENTIALS });
  });

  it('AC-2: a deactivated account gets the same 401 (even with the right password)', async () => {
    account.isActive = false;
    const error = await service.login({ email: 'hr@example.com', password: 'Correct-horse-1' }, '1.1.1.1').catch((e) => e);
    account.isActive = true;
    expect(codeOf(error)).toBe('INVALID_CREDENTIALS');
  });

  it('AC-2: an unknown email still runs a password check (similar timing)', async () => {
    const started = process.hrtime.bigint();
    await service.login({ email: 'nobody@example.com', password: 'whatever-pass' }, '1.1.1.1').catch(() => undefined);
    const unknownMs = Number(process.hrtime.bigint() - started) / 1e6;
    expect(unknownMs).toBeGreaterThan(5); // scrypt ran; a plain "not found" would take well under 1 ms
  });

  it.each([
    ['no email', { password: 'x' }, 'EMAIL_INVALID'],
    ['bad email', { email: 'not-an-email', password: 'x' }, 'EMAIL_INVALID'],
    ['email not a string', { email: ['hr@example.com'], password: 'x' }, 'EMAIL_INVALID'],
    ['no password', { email: 'hr@example.com' }, 'PASSWORD_REQUIRED'],
    ['empty password', { email: 'hr@example.com', password: '' }, 'PASSWORD_REQUIRED'],
    ['no body', undefined, 'EMAIL_INVALID'],
  ])('AC-3: %s → 400 %s, nothing looked up', async (_case, body, code) => {
    const error = await service.login(body, '1.1.1.1').catch((e) => e);
    expect(statusOf(error)).toBe(400);
    expect(codeOf(error)).toBe(code);
    expect(repo.findForLogin).not.toHaveBeenCalled();
  });

  it('AC-4: the 6th try after 5 failures is blocked even with the right password, without checking it', async () => {
    for (let i = 0; i < 5; i++) await service.login({ email: 'hr@example.com', password: 'wrong-password' }, '1.1.1.1').catch(() => undefined);
    repo.findForLogin.mockClear();
    const error = await service.login({ email: 'hr@example.com', password: 'Correct-horse-1' }, '1.1.1.1').catch((e) => e);
    expect(error).toBeInstanceOf(LoginBlockedError);
    expect((error as LoginBlockedError).retryAfterSeconds).toBe(900);
    expect(repo.findForLogin).not.toHaveBeenCalled();
    await expect(service.login({ email: 'hr@example.com', password: 'Correct-horse-1' }, '2.2.2.2')).resolves.toHaveProperty('token'); // other IP
  });

  it('AC-4: a successful login resets the failures', async () => {
    for (let i = 0; i < 4; i++) await service.login({ email: 'hr@example.com', password: 'wrong-password' }, '1.1.1.1').catch(() => undefined);
    await service.login({ email: 'hr@example.com', password: 'Correct-horse-1' }, '1.1.1.1');
    for (let i = 0; i < 4; i++) await service.login({ email: 'hr@example.com', password: 'wrong-password' }, '1.1.1.1').catch(() => undefined);
    await expect(service.login({ email: 'hr@example.com', password: 'Correct-horse-1' }, '1.1.1.1')).resolves.toHaveProperty('token');
  });

  describe('userFromToken (AC-6)', () => {
    it('returns the active HR of a valid token', async () => {
      repo.findActiveSessionUser.mockResolvedValue({ id: account.id, name: 'HR Admin', email: 'hr@example.com' });
      const token = await jwt.signAsync({ sub: account.id });
      await expect(service.userFromToken(token)).resolves.toEqual({ id: account.id, name: 'HR Admin', email: 'hr@example.com' });
    });

    it('"expired" for an expired token, "invalid" for a bad signature, garbage or a gone / inactive account', async () => {
      const expired = await new JwtService({ secret: SECRET }).signAsync({ sub: account.id, exp: Math.floor(Date.now() / 1000) - 10 });
      await expect(service.userFromToken(expired)).resolves.toBe('expired');
      const otherKey = await new JwtService({ secret: 'o'.repeat(32) }).signAsync({ sub: account.id });
      await expect(service.userFromToken(otherKey)).resolves.toBe('invalid');
      await expect(service.userFromToken('not-a-jwt')).resolves.toBe('invalid');
      repo.findActiveSessionUser.mockResolvedValue(null);
      await expect(service.userFromToken(await jwt.signAsync({ sub: account.id }))).resolves.toBe('invalid');
    });
  });
});
