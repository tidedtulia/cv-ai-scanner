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
} as const;

/** Messages shared by the form (client validation) and the API (server validation) — keep FE & BE in sync */
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
} as const;
