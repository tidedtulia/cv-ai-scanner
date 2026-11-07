/** Name of the httpOnly cookie that holds the HR session (a JWT) */
export const HR_SESSION_COOKIE = 'cvs_hr_session';

/** Lifetime of an HR session; no refresh token in the MVP */
export const HR_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Minimum length of JWT_SECRET — the backend refuses to start with a shorter one */
export const JWT_SECRET_MIN_LENGTH = 32;

/** Brute-force protection: after LOGIN_MAX_FAILURES wrong logins within the window, block for LOGIN_BLOCK_SECONDS */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60;
export const LOGIN_BLOCK_SECONDS = 15 * 60;

/** HR account rules */
export const USER_NAME_MAX_LENGTH = 255;
export const USER_PASSWORD_MIN_LENGTH = 8;
/** scrypt has no 72-byte limit like bcrypt; kept to bound the hashing work per request */
export const USER_PASSWORD_MAX_LENGTH = 72;

/** English messages of the auth API; the key is returned as `code` so the bilingual HR UI translates it */
export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Incorrect email or password',
  EMAIL_INVALID: 'Invalid email address',
  PASSWORD_REQUIRED: 'Password is required',
  TOO_MANY_ATTEMPTS: 'Too many failed attempts. Please try again later.',
  UNAUTHENTICATED: 'Please sign in',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  JSON_REQUIRED: 'Content-Type must be application/json',
} as const;

export type AuthMessageCode = keyof typeof AUTH_MESSAGES;

/** English messages of /api/hr/users */
export const USER_MESSAGES = {
  NAME_REQUIRED: 'Name is required',
  NAME_TOO_LONG: `Name must not exceed ${USER_NAME_MAX_LENGTH} characters`,
  EMAIL_INVALID: 'Invalid email address',
  EMAIL_TAKEN: 'This email is already used by another account',
  PASSWORD_LENGTH: `Password must be ${USER_PASSWORD_MIN_LENGTH}-${USER_PASSWORD_MAX_LENGTH} characters`,
  IS_ACTIVE_INVALID: 'isActive must be true or false',
  CANNOT_CHANGE_OWN_ACCOUNT: 'You cannot delete or deactivate your own account',
  USER_NOT_FOUND: 'Account not found',
} as const;

export type UserMessageCode = keyof typeof USER_MESSAGES;
