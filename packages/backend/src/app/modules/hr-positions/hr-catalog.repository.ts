import { Injectable } from '@nestjs/common';
import { SORT_ORDER_STEP } from '@org/shared';
import { PrismaService } from '../../database/prisma.service';

export type CatalogKind = 'category' | 'level';

interface CatalogRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  _count: { positions: number };
}

/** The two catalogs have the same columns; this is the part of each Prisma delegate that is used */
interface Delegate {
  findMany(args: object): Promise<CatalogRow[]>;
  findFirst(args: object): Promise<{ id: string } | null>;
  findUnique(args: object): Promise<{ id: string } | null>;
  aggregate(args: object): Promise<{ _max: { sortOrder: number | null } }>;
  create(args: object): Promise<{ id: string }>;
  update(args: object): Promise<{ id: string }>;
}

const SELECT = { id: true, code: true, name: true, sortOrder: true, isActive: true, _count: { select: { positions: true } } } as const;

/** Job categories and job levels (hr-positions AC-9 → AC-11) */
@Injectable()
export class HrCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(kind: CatalogKind): Delegate {
    return (kind === 'category' ? this.prisma.jobCategory : this.prisma.jobLevel) as unknown as Delegate;
  }

  list(kind: CatalogKind) {
    return this.delegate(kind).findMany({ select: SELECT, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }] });
  }

  findById(kind: CatalogKind, id: string) {
    return this.delegate(kind).findUnique({ where: { id }, select: { id: true } });
  }

  async codeExists(kind: CatalogKind, code: string) {
    return Boolean(await this.delegate(kind).findFirst({ where: { code }, select: { id: true } }));
  }

  /** Same name, ignoring case, on another row */
  async nameExists(kind: CatalogKind, name: string, exceptId?: string) {
    return Boolean(
      await this.delegate(kind).findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
        select: { id: true },
      }),
    );
  }

  async nextSortOrder(kind: CatalogKind) {
    const last = await this.delegate(kind).aggregate({ _max: { sortOrder: true } });
    return (last._max.sortOrder ?? 0) + SORT_ORDER_STEP;
  }

  create(kind: CatalogKind, data: { code: string; name: string; sortOrder: number }) {
    return this.delegate(kind).create({ data: { ...data, isActive: true }, select: { id: true } });
  }

  update(kind: CatalogKind, id: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
    return this.delegate(kind).update({ where: { id }, data, select: { id: true } });
  }
}
