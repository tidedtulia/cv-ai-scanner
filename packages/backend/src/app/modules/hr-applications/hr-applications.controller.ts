import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { API_ROUTES } from '@org/shared';
import type { IHrSessionUser } from '@org/shared';
import { CurrentHrUser } from '../auth/hr-session.decorators';
import { HrApplicationsService } from './hr-applications.service';

/** `inline; filename="<ASCII fallback>"; filename*=UTF-8''<encoded>` so Vietnamese names survive (AC-5) */
export function inlineDisposition(fileName: string): string {
  const fallback = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** /api/hr/applications* — behind HrAuthGuard (every /api/hr/* route), hr-applications AC-1 → AC-8 */
@Controller()
export class HrApplicationsController {
  constructor(private readonly service: HrApplicationsService) {}

  @Get(API_ROUTES.HR_APPLICATION_FILTERS)
  filters() {
    return this.service.filters();
  }

  @Get(API_ROUTES.HR_APPLICATIONS)
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Get(`${API_ROUTES.HR_APPLICATIONS}/:id`)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }

  @Get(`${API_ROUTES.HR_APPLICATIONS}/:id/cv`)
  async cv(@Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    const { content, fileName } = await this.service.cv(id);
    response
      .status(HttpStatus.OK)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(content.length),
        'Content-Disposition': inlineDisposition(fileName),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .end(content);
  }

  @Get(`${API_ROUTES.HR_APPLICATIONS}/:id/email-preview`)
  emailPreview(@Param('id', ParseUUIDPipe) id: string, @Query('decision') decision: unknown) {
    return this.service.emailPreview(id, decision);
  }

  @Post(`${API_ROUTES.HR_APPLICATIONS}/:id/decision`)
  @HttpCode(HttpStatus.OK)
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentHrUser() me: IHrSessionUser) {
    return this.service.decide(id, body, me.id);
  }

  @Post(`${API_ROUTES.HR_APPLICATIONS}/:id/resend-email`)
  @HttpCode(HttpStatus.OK)
  resendEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.resendEmail(id);
  }

  @Post(`${API_ROUTES.HR_APPLICATIONS}/:id/re-evaluate`)
  @HttpCode(HttpStatus.OK)
  reEvaluate(@Param('id', ParseUUIDPipe) id: string, @CurrentHrUser() me: IHrSessionUser) {
    return this.service.reEvaluate(id, me.id);
  }
}
