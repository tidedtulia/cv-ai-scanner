import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PositionsController } from './positions.controller';
import { PositionsRepository } from './positions.repository';
import { PositionsService } from './positions.service';

@Module({
  imports: [PrismaModule],
  controllers: [PositionsController],
  providers: [PositionsService, PositionsRepository],
  exports: [PositionsService],
})
export class PositionsModule {}
