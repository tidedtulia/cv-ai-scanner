import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PositionsModule } from './modules/positions/positions.module';
import { JobCatalogModule } from './modules/job-catalog/job-catalog.module';
import { ApplicationsModule } from './modules/applications/applications.module';

@Module({
  imports: [AuthModule, UsersModule, PositionsModule, JobCatalogModule, ApplicationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
