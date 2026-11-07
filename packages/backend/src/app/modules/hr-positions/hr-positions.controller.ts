import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { API_ROUTES } from '@org/shared';
import { HrCatalogService } from './hr-catalog.service';
import { HrCriteriaService } from './hr-criteria.service';
import { HrPositionsService } from './hr-positions.service';

/** /api/hr/positions* — behind HrAuthGuard (every /api/hr/* route), hr-positions AC-1 → AC-8 */
@Controller(API_ROUTES.HR_POSITIONS)
export class HrPositionsController {
  constructor(
    private readonly positions: HrPositionsService,
    private readonly criteria: HrCriteriaService,
  ) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.positions.list(query);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.positions.create(body);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.detail(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.positions.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.positions.remove(id);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.positions.setStatus(id, body);
  }

  @Post(':id/criteria')
  addCriterion(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.criteria.add(id, body);
  }

  @Patch(':id/criteria/:criterionId')
  updateCriterion(@Param('id', ParseUUIDPipe) id: string, @Param('criterionId', ParseUUIDPipe) criterionId: string, @Body() body: unknown) {
    return this.criteria.update(id, criterionId, body);
  }

  @Delete(':id/criteria/:criterionId')
  removeCriterion(@Param('id', ParseUUIDPipe) id: string, @Param('criterionId', ParseUUIDPipe) criterionId: string) {
    return this.criteria.remove(id, criterionId);
  }

  @Post(':id/criteria/:criterionId/move')
  @HttpCode(HttpStatus.OK)
  moveCriterion(@Param('id', ParseUUIDPipe) id: string, @Param('criterionId', ParseUUIDPipe) criterionId: string, @Body() body: unknown) {
    return this.criteria.move(id, criterionId, body);
  }
}

/** /api/hr/job-categories and /api/hr/job-levels (hr-positions AC-9 → AC-11) */
@Controller()
export class HrCatalogController {
  constructor(private readonly catalog: HrCatalogService) {}

  @Get(API_ROUTES.HR_JOB_CATEGORIES)
  categories() {
    return this.catalog.list('category');
  }

  @Post(API_ROUTES.HR_JOB_CATEGORIES)
  createCategory(@Body() body: unknown) {
    return this.catalog.create('category', body);
  }

  @Patch(`${API_ROUTES.HR_JOB_CATEGORIES}/:id`)
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.update('category', id, body);
  }

  @Get(API_ROUTES.HR_JOB_LEVELS)
  levels() {
    return this.catalog.list('level');
  }

  @Post(API_ROUTES.HR_JOB_LEVELS)
  createLevel(@Body() body: unknown) {
    return this.catalog.create('level', body);
  }

  @Patch(`${API_ROUTES.HR_JOB_LEVELS}/:id`)
  updateLevel(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.catalog.update('level', id, body);
  }
}
