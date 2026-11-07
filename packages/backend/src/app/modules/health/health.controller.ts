import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export const HEALTH_DB_TIMEOUT_MS = 3000;

/**
 * Probes of the container platform (azure-deploy AC-1). Public, no session, no secrets in the answers.
 * `/api/health` = the process is alive (never touches the DB, so a DB outage does not restart the container);
 * `/api/health/ready` = it can serve requests (the DB answers `SELECT 1` within 3 seconds).
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`database did not answer within ${HEALTH_DB_TIMEOUT_MS} ms`)), HEALTH_DB_TIMEOUT_MS);
        }),
      ]);
      return { status: 'ok', database: 'up' };
    } catch (cause) {
      // The log gets the reason; the answer never carries connection strings, hosts or messages
      this.logger.error(`Readiness check failed: ${(cause as Error).message?.split('\n')[0]}`);
      throw new HttpException({ status: 'error', database: 'down' }, HttpStatus.SERVICE_UNAVAILABLE);
    } finally {
      clearTimeout(timer);
    }
  }
}
