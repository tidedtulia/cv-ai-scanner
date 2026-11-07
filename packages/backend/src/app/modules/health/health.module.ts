import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { HealthController } from './health.controller';

/** /api/health, /api/health/ready (Phase 5) */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
