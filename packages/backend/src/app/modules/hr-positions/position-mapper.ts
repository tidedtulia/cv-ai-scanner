import type { IHrPositionDetail, IHrPositionListItem } from '@org/shared';
import type { PositionRow } from './hr-positions.repository';

export function toListItem(row: PositionRow): IHrPositionListItem {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    category: { code: row.category.code, name: row.category.name },
    level: { code: row.level.code, name: row.level.name },
    minYearsExperience: row.minYearsExperience,
    status: row.status,
    criteriaCount: row._count.criteria,
    applicationCount: row._count.applications,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** `warn`: the job already has applications and the change touches what the AI uses (hr-positions AC-4, AC-7) */
export function toDetail(row: PositionRow, warn = false): IHrPositionDetail {
  return {
    ...toListItem(row),
    description: row.description,
    criteria: row.criteria.map((c) => ({ id: c.id, name: c.name, type: c.type, description: c.description, weight: c.weight, isRequired: c.isRequired, sortOrder: c.sortOrder })),
    ...(warn && row._count.applications > 0 ? { warning: 'HAS_APPLICATIONS' as const } : {}),
  };
}
