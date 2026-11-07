import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsRepository } from './applications.repository';
import { ApplicationsService } from './applications.service';
import { cvStorageProvider } from './storage/cv-storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepository, cvStorageProvider],
  // The HR area reads the stored CVs (hr-applications AC-5)
  exports: [cvStorageProvider],
})
export class ApplicationsModule {}
