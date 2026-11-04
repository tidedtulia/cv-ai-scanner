import { Controller, Get, Param, Query } from '@nestjs/common';
import { API_ROUTES } from '@org/shared';
import { PositionsService } from './positions.service';

/** Public, no auth: open job postings for /jobs and /submit-cv. */
@Controller(API_ROUTES.POSITIONS)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  findOpen(@Query('category') category?: string, @Query('level') level?: string) {
    return this.positionsService.findOpen({ category, level });
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.positionsService.findOpenByCode(code);
  }
}
