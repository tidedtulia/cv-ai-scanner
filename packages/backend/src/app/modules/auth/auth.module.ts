import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { HR_SESSION_MAX_AGE_SECONDS } from '@org/shared';
import { PrismaModule } from '../../database/prisma.module';
import { readJwtSecret } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { HrAuthGuard } from './hr-auth.guard';
import { LoginAttemptsService } from './login-attempts.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      // Throws (and the backend does not start) when JWT_SECRET is missing or too short (AC-7)
      useFactory: () => ({
        secret: readJwtSecret(),
        signOptions: { algorithm: 'HS256', expiresIn: HR_SESSION_MAX_AGE_SECONDS },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, LoginAttemptsService, { provide: APP_GUARD, useClass: HrAuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
