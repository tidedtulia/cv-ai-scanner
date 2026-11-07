import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_MESSAGES, AuthMessageCode, IHrSessionUser, isValidEmail } from '@org/shared';
import { apiException } from '../../common/api-error';
import { hashPassword, verifyPassword } from '../../common/password';
import { AuthRepository } from './auth.repository';
import { LoginAttemptsService } from './login-attempts.service';

export interface SessionTokenPayload {
  /** users.id */
  sub: string;
}

/** Thrown while an email + IP is blocked (AC-4); the controller adds the Retry-After header */
export class LoginBlockedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(AUTH_MESSAGES.TOO_MANY_ATTEMPTS);
  }
}

export const authError = (status: HttpStatus, code: AuthMessageCode) => apiException(status, code, AUTH_MESSAGES[code]);

@Injectable()
export class AuthService implements OnModuleInit {
  /** Hash checked when the email is unknown, so both cases take about the same time (AC-2) */
  private dummyHash = '';

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwt: JwtService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await hashPassword('not-a-real-password-used-for-timing');
  }

  async login(body: unknown, ip: string): Promise<{ user: IHrSessionUser; token: string }> {
    const input = (body ?? {}) as Record<string, unknown>;
    const email = typeof input['email'] === 'string' ? input['email'].trim().toLowerCase() : '';
    const password = typeof input['password'] === 'string' ? input['password'] : '';
    if (!isValidEmail(email)) throw authError(HttpStatus.BAD_REQUEST, 'EMAIL_INVALID');
    if (!password) throw authError(HttpStatus.BAD_REQUEST, 'PASSWORD_REQUIRED');

    const key = LoginAttemptsService.key(email, ip);
    const retryAfter = this.attempts.retryAfterSeconds(key);
    if (retryAfter > 0) throw new LoginBlockedError(retryAfter);

    const account = await this.authRepo.findForLogin(email);
    const passwordOk = await verifyPassword(password, account?.passwordHash ?? this.dummyHash);
    if (!account || !passwordOk || !account.isActive) {
      this.attempts.recordFailure(key);
      throw authError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS');
    }

    this.attempts.reset(key);
    const user = { id: account.id, name: account.name, email: account.email };
    const token = await this.jwt.signAsync({ sub: user.id } satisfies SessionTokenPayload);
    return { user, token };
  }

  /** The HR of a valid session token, or why it is refused (used by the guard) */
  async userFromToken(token: string): Promise<IHrSessionUser | 'expired' | 'invalid'> {
    let payload: SessionTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionTokenPayload>(token);
    } catch (error) {
      return (error as Error).name === 'TokenExpiredError' ? 'expired' : 'invalid';
    }
    if (typeof payload?.sub !== 'string') return 'invalid';
    return (await this.authRepo.findActiveSessionUser(payload.sub)) ?? 'invalid';
  }
}
