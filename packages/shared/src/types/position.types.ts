/**
 * Public job data — the shape returned by the candidate-facing API.
 * Internal fields (ids, status, scoring guidance, weight, is_required) are never exposed.
 * See docs/features/public-jobs-api/requirements.md.
 */

/** Mirrors the `criterion_type` enum in the database. */
export type CriterionType = 'TECHNICAL' | 'EXPERIENCE' | 'SOFT_SKILL' | 'LANGUAGE' | 'EDUCATION';

export interface IJobCategory {
  code: string;
  name: string;
}

export interface IJobLevel {
  code: string;
  name: string;
}

export interface IPublicCriterion {
  name: string;
  type: CriterionType;
}

/** One item of GET /api/positions */
export interface IPublicPositionSummary {
  /** Public identifier, used in /submit-cv?position=<code> */
  code: string;
  title: string;
  category: IJobCategory;
  level: IJobLevel;
  minYearsExperience: number;
  criteria: IPublicCriterion[];
}

/** GET /api/positions/:code — summary + full JD (markdown) */
export interface IPublicPositionDetail extends IPublicPositionSummary {
  description: string;
}
