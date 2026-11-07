import { Injectable } from '@nestjs/common';
import type { ApplicationLocale } from '@org/shared';
import { PrismaService } from '../../database/prisma.service';

export interface NewApplication {
  id: string;
  fullName: string;
  email: string;
  locale: ApplicationLocale;
  positionId: string;
  cvFileName: string;
  cvDriveFileId: string;
  cvDriveUrl: string;
}

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Only OPEN positions accept applications. */
  findOpenPosition(code: string) {
    return this.prisma.position.findFirst({
      where: { status: 'OPEN', code: { equals: code, mode: 'insensitive' } },
      select: { id: true, code: true },
    });
  }

  /** Application + its first status-history row (NULL → SUBMITTED, by the system) in one statement. */
  create(data: NewApplication) {
    return this.prisma.application.create({
      data: { ...data, statusHistory: { create: { toStatus: 'SUBMITTED' } } },
      select: { id: true },
    });
  }
}
