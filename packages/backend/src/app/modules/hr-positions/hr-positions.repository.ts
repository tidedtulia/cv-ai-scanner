import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SORT_ORDER_STEP, type CriterionType, type PositionStatus } from '@org/shared';
import { PrismaService } from '../../database/prisma.service';

const DETAIL_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  minYearsExperience: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { code: true, name: true, isActive: true } },
  level: { select: { code: true, name: true, isActive: true } },
  criteria: {
    select: { id: true, name: true, type: true, description: true, weight: true, isRequired: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  },
  _count: { select: { applications: true, criteria: true } },
} satisfies Prisma.PositionSelect;

export type PositionRow = Prisma.PositionGetPayload<{ select: typeof DETAIL_SELECT }>;

export const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
export const isForeignKeyViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';

export interface CriterionData {
  name: string;
  type: CriterionType;
  description: string | null;
  weight: number;
  isRequired: boolean;
}

/** Jobs and their criteria (hr-positions AC-1 → AC-8). Writes that depend on a read run in one transaction. */
@Injectable()
export class HrPositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: PositionStatus) {
    return this.prisma.position.findMany({
      where: status ? { status } : {},
      select: DETAIL_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  findById(id: string) {
    return this.prisma.position.findUnique({ where: { id }, select: DETAIL_SELECT });
  }

  findCategory(code: string) {
    return this.prisma.jobCategory.findFirst({ where: { code: { equals: code, mode: 'insensitive' } }, select: { id: true, code: true, isActive: true } });
  }

  findLevel(code: string) {
    return this.prisma.jobLevel.findFirst({ where: { code: { equals: code, mode: 'insensitive' } }, select: { id: true, code: true, isActive: true } });
  }

  async codeExists(code: string) {
    return (await this.prisma.position.count({ where: { code } })) > 0;
  }

  create(data: { code: string; title: string; categoryId: string; levelId: string; minYearsExperience: number; description: string }) {
    return this.prisma.position.create({ data: { ...data, status: 'DRAFT' }, select: { id: true } });
  }

  update(id: string, data: Prisma.PositionUncheckedUpdateInput) {
    return this.prisma.position.update({ where: { id }, data, select: { id: true } });
  }

  /** Deletes the job and (by the FK cascade) its criteria, only while it has no application */
  deleteIfUnused(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.position.findUnique({ where: { id }, select: { _count: { select: { applications: true } } } });
      if (!found) return { result: 'not-found' as const };
      if (found._count.applications > 0) return { result: 'has-applications' as const, applicationCount: found._count.applications };
      await tx.position.delete({ where: { id } });
      return { result: 'deleted' as const };
    });
  }

  /** New criterion at the end of the list (largest sort order + step) */
  addCriterion(positionId: string, data: CriterionData) {
    return this.prisma.$transaction(async (tx) => {
      const position = await tx.position.findUnique({ where: { id: positionId }, select: { id: true } });
      if (!position) return { result: 'not-found' as const };
      const last = await tx.positionCriterion.aggregate({ where: { positionId }, _max: { sortOrder: true } });
      await tx.positionCriterion.create({ data: { positionId, ...data, sortOrder: (last._max.sortOrder ?? 0) + SORT_ORDER_STEP } });
      return { result: 'done' as const };
    });
  }

  updateCriterion(positionId: string, criterionId: string, data: Partial<CriterionData>) {
    return this.prisma.$transaction(async (tx) => {
      const criterion = await tx.positionCriterion.findFirst({ where: { id: criterionId, positionId }, select: { id: true } });
      if (!criterion) return { result: 'not-found' as const };
      await tx.positionCriterion.update({ where: { id: criterionId }, data });
      return { result: 'done' as const };
    });
  }

  /** An OPEN job keeps at least one criterion, so WF-1 can always score its applications */
  removeCriterion(positionId: string, criterionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const position = await tx.position.findUnique({ where: { id: positionId }, select: { status: true, _count: { select: { criteria: true } } } });
      const criterion = position && (await tx.positionCriterion.findFirst({ where: { id: criterionId, positionId }, select: { id: true } }));
      if (!position || !criterion) return { result: 'not-found' as const };
      if (position.status === 'OPEN' && position._count.criteria <= 1) return { result: 'last-criterion' as const };
      await tx.positionCriterion.delete({ where: { id: criterionId } });
      return { result: 'done' as const };
    });
  }

  /** Swaps with the neighbour; the sort orders are first normalised to steps of 10 (old data may repeat them) */
  moveCriterion(positionId: string, criterionId: string, direction: 'up' | 'down') {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.positionCriterion.findMany({
        where: { positionId },
        select: { id: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const index = rows.findIndex((row) => row.id === criterionId);
      if (index < 0) return { result: 'not-found' as const };
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target >= 0 && target < rows.length) [rows[index], rows[target]] = [rows[target], rows[index]];
      for (const [position, row] of rows.entries()) {
        const sortOrder = (position + 1) * SORT_ORDER_STEP;
        if (row.sortOrder !== sortOrder) await tx.positionCriterion.update({ where: { id: row.id }, data: { sortOrder } });
      }
      return { result: 'done' as const };
    });
  }
}
