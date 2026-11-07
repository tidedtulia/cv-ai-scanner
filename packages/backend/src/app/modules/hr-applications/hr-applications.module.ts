import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ApplicationsModule } from '../applications/applications.module';
import { MailModule } from '../mail/mail.module';
import { HrApplicationsController } from './hr-applications.controller';
import { HrApplicationsRepository } from './hr-applications.repository';
import { HrApplicationsService } from './hr-applications.service';

/** HR view of the applications (Phase 3.2): list, detail, CV, decision (+ result email), re-evaluation */
@Module({
  imports: [PrismaModule, ApplicationsModule, MailModule],
  controllers: [HrApplicationsController],
  providers: [HrApplicationsService, HrApplicationsRepository],
})
export class HrApplicationsModule {}
