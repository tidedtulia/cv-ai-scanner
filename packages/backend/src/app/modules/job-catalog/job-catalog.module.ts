import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { JobCatalogController } from './job-catalog.controller';
import { JobCatalogRepository } from './job-catalog.repository';
import { JobCatalogService } from './job-catalog.service';

@Module({
  imports: [PrismaModule],
  controllers: [JobCatalogController],
  providers: [JobCatalogService, JobCatalogRepository],
})
export class JobCatalogModule {}
