/** Global API prefix used by the backend */
export const API_PREFIX = 'api';

/** Centralized route paths — keep FE & BE in sync */
export const API_ROUTES = {
  AUTH_LOGIN: 'auth/login',
  AUTH_LOGOUT: 'auth/logout',
  AUTH_ME: 'auth/me',
  /** Every route under /api/hr/* needs an HR session (cookie) */
  HR: 'hr',
  HR_USERS: 'hr/users',
  POSITIONS: 'positions',
  JOB_CATEGORIES: 'job-categories',
  JOB_LEVELS: 'job-levels',
  APPLICATIONS: 'applications',
} as const;
