import type { CriterionType } from './position.types.js';
import type { PositionStatus } from './hr-applications.types.js';

export interface IHrPositionListItem {
  id: string;
  code: string;
  title: string;
  category: { code: string; name: string };
  level: { code: string; name: string };
  minYearsExperience: number;
  status: PositionStatus;
  criteriaCount: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IHrCriterion {
  id: string;
  name: string;
  type: CriterionType;
  /** Scoring guide for Claude (internal) */
  description: string | null;
  weight: number;
  isRequired: boolean;
  sortOrder: number;
}

/** GET /api/hr/positions/:id and the answer of every write on a job / its criteria */
export interface IHrPositionDetail extends IHrPositionListItem {
  description: string;
  criteria: IHrCriterion[];
  /** HAS_APPLICATIONS: the job already has applications, see hr-positions AC-4 / AC-7 */
  warning?: 'HAS_APPLICATIONS';
}

/** Body of POST /api/hr/positions (code optional) and PATCH (every field optional, code ignored) */
export interface IHrPositionInput {
  title: string;
  categoryCode: string;
  levelCode: string;
  minYearsExperience: number;
  description: string;
  code?: string;
}

export interface IHrCriterionInput {
  name: string;
  type: CriterionType;
  description?: string | null;
  weight: number;
  isRequired: boolean;
}

/** Row of GET /api/hr/job-categories and /api/hr/job-levels (hidden ones included) */
export interface IHrCatalogItem {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  positionCount: number;
}

export interface IHrCatalogInput {
  name: string;
  code?: string;
  sortOrder?: number;
  isActive?: boolean;
}
