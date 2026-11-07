import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApplicationStatus, HrApplicationSort, Recommendation } from '@org/shared';
import { PrismaService } from '../../database/prisma.service';

/** Filters of the HR list, already validated by the service */
export interface HrListFilters {
  position?: string;
  category?: string;
  level?: string;
  recommendation?: Recommendation;
  q?: string;
}

export interface HrListRow {
  id: string;
  full_name: string;
  email: string;
  status: ApplicationStatus;
  created_at: Date;
  position_code: string;
  position_title: string;
  category_name: string;
  level_name: string;
  overall_score: Prisma.Decimal | number | string | null;
  recommendation: Recommendation | null;
}

const FROM = Prisma.sql`
  FROM applications a
  JOIN positions p ON p.id = a.position_id
  JOIN job_categories c ON c.id = p.category_id
  JOIN job_levels l ON l.id = p.level_id
  LEFT JOIN evaluations e ON e.application_id = a.id`;

/** ORDER BY of each sort; `a.id` last so that pages never repeat or skip a row (AC-2) */
const ORDER_BY: Record<HrApplicationSort, Prisma.Sql> = {
  score: Prisma.sql`ORDER BY e.overall_score DESC NULLS LAST, a.created_at DESC, a.id ASC`,
  newest: Prisma.sql`ORDER BY a.created_at DESC, a.id ASC`,
};

/** `%text%` for ILIKE, with %, _ and \ matched literally */
export const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** WHERE of the filters (all parameterised); `statuses` omitted for the per-tab counts */
export function whereClause(filters: HrListFilters, statuses?: readonly ApplicationStatus[]): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (statuses) conditions.push(Prisma.sql`a.status::text IN (${Prisma.join([...statuses])})`);
  if (filters.position) conditions.push(Prisma.sql`lower(p.code) = lower(${filters.position})`);
  if (filters.category) conditions.push(Prisma.sql`lower(c.code) = lower(${filters.category})`);
  if (filters.level) conditions.push(Prisma.sql`lower(l.code) = lower(${filters.level})`);
  if (filters.recommendation) conditions.push(Prisma.sql`e.recommendation::text = ${filters.recommendation}`);
  if (filters.q) {
    const pattern = likePattern(filters.q);
    conditions.push(Prisma.sql`(a.full_name ILIKE ${pattern} ESCAPE '\\' OR a.email ILIKE ${pattern} ESCAPE '\\')`);
  }
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}

@Injectable()
export class HrApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One page of the list (raw SQL: score DESC with the not-yet-evaluated applications last) */
  listPage(filters: HrListFilters, statuses: readonly ApplicationStatus[], sort: HrApplicationSort, skip: number, take: number) {
    return this.prisma.$queryRaw<HrListRow[]>`
      SELECT a.id, a.full_name, a.email, a.status::text AS status, a.created_at,
             p.code AS position_code, p.title AS position_title, c.name AS category_name, l.name AS level_name,
             e.overall_score, e.recommendation::text AS recommendation
      ${FROM}
      ${whereClause(filters, statuses)}
      ${ORDER_BY[sort]}
      LIMIT ${take} OFFSET ${skip}`;
  }

  /** Number of applications per status with the same filters (for the tab counts and the total) */
  async countByStatus(filters: HrListFilters): Promise<Partial<Record<ApplicationStatus, number>>> {
    const rows = await this.prisma.$queryRaw<{ status: ApplicationStatus; n: number }[]>`
      SELECT a.status::text AS status, count(*)::int AS n
      ${FROM}
      ${whereClause(filters)}
      GROUP BY a.status`;
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.n)]));
  }

  filterOptions() {
    return Promise.all([
      this.prisma.position.findMany({ select: { code: true, title: true, status: true }, orderBy: [{ title: 'asc' }, { code: 'asc' }] }),
      this.prisma.jobCategory.findMany({ select: { code: true, name: true, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.jobLevel.findMany({ select: { code: true, name: true, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);
  }

  findDetail(id: string) {
    return this.prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        createdAt: true,
        cvFileName: true,
        position: {
          select: {
            code: true,
            title: true,
            minYearsExperience: true,
            status: true,
            category: { select: { name: true } },
            level: { select: { code: true, name: true } },
          },
        },
        evaluation: {
          select: {
            overallScore: true,
            recommendation: true,
            summary: true,
            strengths: true,
            weaknesses: true,
            criteriaScores: true,
            estimatedYearsExperience: true,
            estimatedLevel: { select: { code: true, name: true } },
            aiModel: true,
            promptVersion: true,
            updatedAt: true,
          },
        },
        statusHistory: {
          select: { fromStatus: true, toStatus: true, note: true, createdAt: true, changedBy: { select: { name: true } } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  /** The other applications of the same email, newest first */
  findOthersByEmail(email: string, exceptId: string) {
    return this.prisma.application.findMany({
      where: { email, id: { not: exceptId } },
      select: { id: true, status: true, createdAt: true, position: { select: { title: true } }, evaluation: { select: { overallScore: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  findCvFile(id: string) {
    return this.prisma.application.findUnique({ where: { id }, select: { cvDriveFileId: true, cvFileName: true } });
  }

  /**
   * Compare-and-set of the status + one history row, in one transaction (AC-6, AC-7).
   * Returns 'not-found', the current status when it is not one of `from`, or 'changed' when it was changed meanwhile.
   */
  changeStatus(id: string, from: readonly ApplicationStatus[], to: ApplicationStatus, note: string | null, changedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.application.findUnique({ where: { id }, select: { status: true } });
      if (!current) return { result: 'not-found' as const };
      if (!from.includes(current.status)) return { result: 'not-allowed' as const, status: current.status };
      const updated = await tx.application.updateMany({ where: { id, status: current.status }, data: { status: to } });
      if (updated.count === 0) return { result: 'not-allowed' as const, status: undefined };
      await tx.applicationStatusHistory.create({ data: { applicationId: id, fromStatus: current.status, toStatus: to, note, changedById } });
      return { result: 'done' as const };
    });
  }
}
