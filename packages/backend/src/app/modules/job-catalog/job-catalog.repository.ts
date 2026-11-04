import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Only catalog entries that are active and have at least one OPEN position (PQ3),
 * so every filter option on /jobs returns results. Ids are never exposed.
 */
const FILTERABLE = { isActive: true, positions: { some: { status: 'OPEN' } } } as const;
const PUBLIC_SELECT = { code: true, name: true } as const;

@Injectable()
export class JobCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  findFilterableCategories() {
    return this.prisma.jobCategory.findMany({
      where: FILTERABLE,
      orderBy: { sortOrder: 'asc' },
      select: PUBLIC_SELECT,
    });
  }

  findFilterableLevels() {
    return this.prisma.jobLevel.findMany({
      where: FILTERABLE,
      orderBy: { sortOrder: 'asc' },
      select: PUBLIC_SELECT,
    });
  }
}
