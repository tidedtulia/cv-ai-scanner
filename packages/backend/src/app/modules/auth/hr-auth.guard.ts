import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { API_PREFIX, API_ROUTES } from '@org/shared';
import { authError, AuthService } from './auth.service';
import { HrRequest, REQUIRE_HR_SESSION } from './hr-session.decorators';
import { clearSessionCookieOptions, HR_SESSION_COOKIE, readSessionCookie } from './session-cookie';

const HR_PATH = `/${API_PREFIX}/${API_ROUTES.HR}`;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/** True for /api/hr and /api/hr/... (not /api/hrx) */
export const isHrPath = (path: string) => path === HR_PATH || path.startsWith(`${HR_PATH}/`);

/** JSON body required for writes: an HTML form of another site cannot send it (CSRF, with SameSite=Lax) */
export const isJsonRequest = (request: HrRequest) => {
  const hasBody = Number(request.headers['content-length'] ?? 0) > 0 || request.headers['transfer-encoding'] !== undefined;
  return !hasBody || (request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json');
};

/**
 * Global guard (APP_GUARD): every /api/hr/* route, and routes marked @RequireHrSession(), need a valid
 * session cookie of an active HR (AC-6). Everything else (public API) passes untouched.
 */
@Injectable()
export class HrAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<HrRequest>();
    const marked = this.reflector.getAllAndOverride<boolean>(REQUIRE_HR_SESSION, [context.getHandler(), context.getClass()]);
    if (!marked && !isHrPath(request.path)) return true;

    const response = context.switchToHttp().getResponse<Response>();
    const token = readSessionCookie(request.headers.cookie);
    if (!token) throw authError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED');

    const user = await this.auth.userFromToken(token);
    if (user === 'expired' || user === 'invalid') {
      response.clearCookie(HR_SESSION_COOKIE, clearSessionCookieOptions());
      throw authError(HttpStatus.UNAUTHORIZED, user === 'expired' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED');
    }
    if (WRITE_METHODS.has(request.method) && !isJsonRequest(request)) {
      throw authError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'JSON_REQUIRED');
    }
    request.hrUser = user;
    return true;
  }
}
