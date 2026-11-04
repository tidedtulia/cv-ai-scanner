import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Columns returned by the public API. No ids or status, and criteria expose only
 * name + type — scoring guidance, weight and is_required stay internal (D9).
 */
const PUBLIC_POSITION_SELECT = {
  code: true,
  title: true,
  minYearsExperience: true,
  category: { select: { code: true, name: true } },
  level: { select: { code: true, name: true } },
  criteria: { select: { name: true, type: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.PositionSelect;

export interface PositionFilters {
  /** Job category code, matched case-insensitively */
  category?: string;
  /** Job level code, matched case-insensitively */
  level?: string;
}

@Injectable()
export class PositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOpen(filters: PositionFilters) {
    return this.prisma.position.findMany({
      where: {
        status: 'OPEN',
        ...(filters.category ? { category: { code: { equals: filters.category, mode: 'insensitive' } } } : {}),
        ...(filters.level ? { level: { code: { equals: filters.level, mode: 'insensitive' } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_POSITION_SELECT,
    });
  }

  findOpenByCode(code: string) {
    return this.prisma.position.findFirst({
      where: { status: 'OPEN', code: { equals: code, mode: 'insensitive' } },
      select: { ...PUBLIC_POSITION_SELECT, description: true },
    });
  }
}
