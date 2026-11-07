import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ApplicationsModule } from '../applications/applications.module';
import { HrApplicationsController } from './hr-applications.controller';
import { HrApplicationsRepository } from './hr-applications.repository';
import { HrApplicationsService } from './hr-applications.service';

/** HR view of the applications (Phase 3.2): list, detail, CV, decision, re-evaluation */
@Module({
  imports: [PrismaModule, ApplicationsModule],
  controllers: [HrApplicationsController],
  providers: [HrApplicationsService, HrApplicationsRepository],
})
export class HrApplicationsModule {}
