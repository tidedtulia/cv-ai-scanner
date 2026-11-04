/** Global API prefix used by the backend */
export const API_PREFIX = 'api';

/** Centralized route paths — keep FE & BE in sync */
export const API_ROUTES = {
  USERS: 'users',
  POSITIONS: 'positions',
  JOB_CATEGORIES: 'job-categories',
  JOB_LEVELS: 'job-levels',
  APPLICATIONS: 'applications',
} as const;
