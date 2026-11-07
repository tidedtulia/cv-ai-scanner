import { CV_MAX_FILE_SIZE_MB } from './cv.constants.js';

/** Max length of the text fields — matches the varchar(255) columns of `applications` */
export const APPLICATION_TEXT_MAX_LENGTH = 255;

/** Multipart field names of the apply form — POST /api/applications */
export const APPLICATION_FORM_FIELDS = {
  NAME: 'name',
  EMAIL: 'email',
  /** Position `code`, e.g. frontend-dev */
  POSITION: 'position',
  CV: 'cv',
  /** Privacy-policy consent checkbox; must equal APPLICATION_CONSENT_VALUE */
  CONSENT: 'consent',
  /** UI language of the visitor when applying; the result email is sent in it (result-email AC-1) */
  LOCALE: 'locale',
} as const;

/** Languages of the result email — mirrors the `applications.locale` check constraint */
export const APPLICATION_LOCALES = ['vi', 'en'] as const;
export type ApplicationLocale = (typeof APPLICATION_LOCALES)[number];
export const DEFAULT_APPLICATION_LOCALE: ApplicationLocale = 'vi';

/** Anything that is not a supported language falls back to the default (never an error, AC-1) */
export const normalizeApplicationLocale = (value: unknown): ApplicationLocale =>
  typeof value === 'string' && (APPLICATION_LOCALES as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as ApplicationLocale)
    : DEFAULT_APPLICATION_LOCALE;

export const APPLICATION_CONSENT_VALUE = 'true';

/**
 * English messages shared by the form (client validation) and the API (server validation) — keep FE & BE in sync.
 * API errors also return the key as `code`, so the bilingual form shows the message in the visitor's language.
 */
export const APPLICATION_MESSAGES = {
  SUBMITTED: 'Submit CV successfully',
  NAME_REQUIRED: 'Name is required',
  NAME_TOO_LONG: `Name must not exceed ${APPLICATION_TEXT_MAX_LENGTH} characters`,
  EMAIL_REQUIRED: 'Email is required',
  EMAIL_INVALID: 'Invalid email address',
  POSITION_REQUIRED: 'Please select a position',
  POSITION_NOT_OPEN: 'This position is not accepting applications',
  CV_REQUIRED: 'Please upload your CV',
  CV_NOT_PDF: 'Only PDF files are accepted',
  CV_TOO_LARGE: `File size must not exceed ${CV_MAX_FILE_SIZE_MB}MB`,
  UPLOAD_FAILED: 'Failed to upload CV. Please try again.',
  CONSENT_REQUIRED: 'Please agree to the privacy policy to apply',
} as const;

export type ApplicationMessageCode = keyof typeof APPLICATION_MESSAGES;

/** Body of an error response from POST /api/applications */
export interface ApplicationErrorResponse {
  statusCode: number;
  error: string;
  code: ApplicationMessageCode;
  message: string;
}
