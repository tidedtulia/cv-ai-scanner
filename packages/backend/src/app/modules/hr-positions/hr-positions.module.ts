import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { HrCatalogRepository } from './hr-catalog.repository';
import { HrCatalogService } from './hr-catalog.service';
import { HrCriteriaService } from './hr-criteria.service';
import { HrCatalogController, HrPositionsController } from './hr-positions.controller';
import { HrPositionsRepository } from './hr-positions.repository';
import { HrPositionsService } from './hr-positions.service';

/** HR management of jobs, criteria and the category / level catalogs (Phase 3.3) */
@Module({
  imports: [PrismaModule],
  controllers: [HrPositionsController, HrCatalogController],
  providers: [HrPositionsService, HrCriteriaService, HrCatalogService, HrPositionsRepository, HrCatalogRepository],
})
export class HrPositionsModule {}
