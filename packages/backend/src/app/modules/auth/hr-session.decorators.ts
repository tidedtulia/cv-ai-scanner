import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { IHrSessionUser } from '@org/shared';

/** A request that went through HrAuthGuard */
export interface HrRequest extends Request {
  hrUser?: IHrSessionUser;
}

export const REQUIRE_HR_SESSION = 'requireHrSession';

/** Requires an HR session on a route outside /api/hr/* (e.g. GET /api/auth/me) */
export const RequireHrSession = () => SetMetadata(REQUIRE_HR_SESSION, true);

/** The signed-in HR (only on routes protected by HrAuthGuard) */
export const CurrentHrUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): IHrSessionUser => {
  return ctx.switchToHttp().getRequest<HrRequest>().hrUser as IHrSessionUser;
});
