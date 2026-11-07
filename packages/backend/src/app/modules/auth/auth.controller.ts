import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { API_ROUTES } from '@org/shared';
import type { IHrSessionResponse, IHrSessionUser } from '@org/shared';
import { apiErrorBody } from '../../common/api-error';
import { authError, AuthService, LoginBlockedError } from './auth.service';
import { CurrentHrUser, RequireHrSession } from './hr-session.decorators';
import type { HrRequest } from './hr-session.decorators';
import { isJsonRequest } from './hr-auth.guard';
import { clearSessionCookieOptions, HR_SESSION_COOKIE, sessionCookieOptions } from './session-cookie';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/login — sets the session cookie; the token is never in the body (AC-1 → AC-4) */
  @Post(API_ROUTES.AUTH_LOGIN)
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() request: HrRequest, @Res({ passthrough: true }) response: Response): Promise<IHrSessionResponse> {
    if (!isJsonRequest(request)) throw authError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'JSON_REQUIRED');
    try {
      const { user, token } = await this.auth.login(body, request.ip ?? 'unknown');
      response.cookie(HR_SESSION_COOKIE, token, sessionCookieOptions());
      return { user };
    } catch (error) {
      if (error instanceof LoginBlockedError) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
        throw new HttpException(apiErrorBody(HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_ATTEMPTS', error.message), HttpStatus.TOO_MANY_REQUESTS);
      }
      throw error;
    }
  }

  /** POST /api/auth/logout — always 204, clears the cookie (AC-5) */
  @Post(API_ROUTES.AUTH_LOGOUT)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(HR_SESSION_COOKIE, clearSessionCookieOptions());
  }

  /** GET /api/auth/me — the signed-in HR (AC-5) */
  @Get(API_ROUTES.AUTH_ME)
  @RequireHrSession()
  me(@CurrentHrUser() user: IHrSessionUser): IHrSessionResponse {
    return { user };
  }
}
