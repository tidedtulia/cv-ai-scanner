import type { CriterionType } from '../types/position.types.js';
import type { PositionStatus } from '../types/hr-applications.types.js';

/** Limits of the HR job / criteria / catalog forms (hr-positions requirements, "Hằng số") */
export const POSITION_TITLE_MAX_LENGTH = 255;
export const POSITION_DESCRIPTION_MAX_LENGTH = 20_000;
export const CRITERION_GUIDE_MAX_LENGTH = 2_000;
export const NAME_MAX_LENGTH = 255;
export const MIN_YEARS_MAX = 50;
export const CRITERION_WEIGHT_MIN = 1;
export const CRITERION_WEIGHT_MAX = 5;
export const CODE_MIN_LENGTH = 2;
export const CODE_MAX_LENGTH = 64;
/** `sort_order` step used for new rows and when the order is normalised */
export const SORT_ORDER_STEP = 10;

export const POSITION_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATALOG_CODE_PATTERN = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

export const POSITION_STATUSES: readonly PositionStatus[] = ['DRAFT', 'OPEN', 'CLOSED'];
export const CRITERION_TYPES: readonly CriterionType[] = ['TECHNICAL', 'EXPERIENCE', 'SOFT_SKILL', 'LANGUAGE', 'EDUCATION'];

/** English messages of the HR positions / catalog API; the key is returned as `code` so the bilingual UI translates it */
export const HR_POSITION_MESSAGES = {
  INVALID_QUERY: 'Invalid list parameters',
  POSITION_NOT_FOUND: 'Job not found',
  CRITERION_NOT_FOUND: 'Criterion not found',
  CATEGORY_NOT_FOUND: 'Category not found',
  LEVEL_NOT_FOUND: 'Level not found',
  TITLE_REQUIRED: 'Title is required',
  TITLE_TOO_LONG: `Title must not exceed ${POSITION_TITLE_MAX_LENGTH} characters`,
  DESCRIPTION_REQUIRED: 'The job description is required',
  DESCRIPTION_TOO_LONG: `The job description must not exceed ${POSITION_DESCRIPTION_MAX_LENGTH} characters`,
  YEARS_INVALID: `Years of experience must be a whole number from 0 to ${MIN_YEARS_MAX}`,
  CATEGORY_INVALID: 'Choose a category that is shown',
  LEVEL_INVALID: 'Choose a level that is shown',
  CODE_INVALID: 'The code format is invalid',
  CODE_TAKEN: 'This code is already used',
  STATUS_INVALID: 'Status must be DRAFT, OPEN or CLOSED',
  CRITERIA_REQUIRED: 'Add at least 1 criterion before opening the job',
  POSITION_HAS_APPLICATIONS: 'This job already has applications, so it cannot be deleted. Close it instead.',
  LAST_CRITERION: 'Close the job before deleting its last criterion',
  NAME_REQUIRED: 'Name is required',
  NAME_TOO_LONG: `Name must not exceed ${NAME_MAX_LENGTH} characters`,
  NAME_TAKEN: 'This name is already used',
  TYPE_INVALID: 'Invalid criterion type',
  WEIGHT_INVALID: `Weight must be a whole number from ${CRITERION_WEIGHT_MIN} to ${CRITERION_WEIGHT_MAX}`,
  GUIDE_TOO_LONG: `The scoring guide must not exceed ${CRITERION_GUIDE_MAX_LENGTH} characters`,
  DIRECTION_INVALID: 'direction must be up or down',
  SORT_ORDER_INVALID: 'The order must be a whole number',
  IS_ACTIVE_INVALID: 'isActive must be true or false',
  IS_REQUIRED_INVALID: 'isRequired must be true or false',
} as const;

export type HrPositionMessageCode = keyof typeof HR_POSITION_MESSAGES;
