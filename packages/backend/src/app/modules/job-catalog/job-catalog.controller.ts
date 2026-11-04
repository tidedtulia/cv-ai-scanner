import { Controller, Get } from '@nestjs/common';
import { API_ROUTES } from '@org/shared';
import { JobCatalogService } from './job-catalog.service';

/** Public, no auth: filter options for /jobs. */
@Controller()
export class JobCatalogController {
  constructor(private readonly catalogService: JobCatalogService) {}

  @Get(API_ROUTES.JOB_CATEGORIES)
  findCategories() {
    return this.catalogService.findFilterableCategories();
  }

  @Get(API_ROUTES.JOB_LEVELS)
  findLevels() {
    return this.catalogService.findFilterableLevels();
  }
}
