import type { ApplicationStatus, HrApplicationTab } from '../types/hr-applications.types.js';

/** Statuses of each tab of the HR list (hr-applications AC-1, AC-9) */
export const HR_APPLICATION_TABS: Record<HrApplicationTab, readonly ApplicationStatus[]> = {
  'to-decide': ['EVALUATED', 'EVALUATION_FAILED'],
  pending: ['SUBMITTED', 'EVALUATING'],
  decided: ['ACCEPTED', 'REJECTED'],
  all: ['SUBMITTED', 'EVALUATING', 'EVALUATED', 'EVALUATION_FAILED', 'ACCEPTED', 'REJECTED'],
};

export const HR_APPLICATION_TAB_KEYS = Object.keys(HR_APPLICATION_TABS) as HrApplicationTab[];
export const HR_DEFAULT_APPLICATION_TAB: HrApplicationTab = 'to-decide';

/** HR can accept / reject or ask for a re-evaluation only in these statuses (AC-6, AC-7) */
export const HR_ACTIONABLE_STATUSES: readonly ApplicationStatus[] = ['EVALUATED', 'EVALUATION_FAILED'];

export const HR_APPLICATIONS_PAGE_SIZE = 20;
export const HR_SEARCH_MAX_LENGTH = 255;
export const HR_DECISION_NOTE_MAX_LENGTH = 2000;
/** Statuses whose result email is sent (or resent) — the final decisions */
export const HR_DECIDED_STATUSES: readonly ApplicationStatus[] = ['ACCEPTED', 'REJECTED'];

export const HR_RE_EVALUATE_NOTE = 'HR yêu cầu đánh giá lại';

/** English messages of the HR applications API; the key is returned as `code` */
export const HR_APPLICATION_MESSAGES = {
  INVALID_QUERY: 'Invalid list parameters',
  APPLICATION_NOT_FOUND: 'Application not found',
  CV_NOT_FOUND: 'The CV file is no longer available',
  CV_UNAVAILABLE: 'The CV cannot be loaded right now',
  DECISION_INVALID: 'decision must be ACCEPTED or REJECTED',
  NOTE_TOO_LONG: `The note must be text of at most ${HR_DECISION_NOTE_MAX_LENGTH} characters`,
  STATUS_NOT_ALLOWED: 'This action is not possible in the current status of the application',
  EMAIL_ALREADY_SENT: 'The result email was already sent',
  EMAIL_SEND_FAILED: 'The email could not be sent right now',
} as const;

export type HrApplicationMessageCode = keyof typeof HR_APPLICATION_MESSAGES;
