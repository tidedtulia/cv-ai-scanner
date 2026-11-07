import type { ApplicationLocale } from '../constants/application.constants.js';
import type { CriterionType } from './position.types.js';

/** Mirrors the `application_status` enum */
export type ApplicationStatus = 'SUBMITTED' | 'EVALUATING' | 'EVALUATED' | 'EVALUATION_FAILED' | 'ACCEPTED' | 'REJECTED';
/** Mirrors the `recommendation` enum */
export type Recommendation = 'RECOMMENDED' | 'CONSIDER' | 'NOT_RECOMMENDED';
/** Mirrors the `position_status` enum */
export type PositionStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export type HrApplicationTab = 'to-decide' | 'pending' | 'decided' | 'all';
export type HrApplicationSort = 'score' | 'newest';
export type HrDecision = 'ACCEPTED' | 'REJECTED';

/** Query of GET /api/hr/applications (all optional) */
export interface IHrApplicationQuery {
  tab?: HrApplicationTab;
  position?: string;
  category?: string;
  level?: string;
  recommendation?: Recommendation;
  q?: string;
  sort?: HrApplicationSort;
  page?: number;
}

export interface IHrPositionRef {
  code: string;
  title: string;
  category: string;
  level: string;
}

/** One row of GET /api/hr/applications */
export interface IHrApplicationListItem {
  id: string;
  fullName: string;
  email: string;
  status: ApplicationStatus;
  /** ISO date: when the candidate applied */
  createdAt: string;
  position: IHrPositionRef;
  overallScore: number | null;
  recommendation: Recommendation | null;
  /** Decided (ACCEPTED / REJECTED) but the result email is not sent yet (result-email AC-7) */
  emailPending: boolean;
}

export interface IHrApplicationListResponse {
  items: IHrApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Number of applications of every tab, with the same filters */
  counts: Record<HrApplicationTab, number>;
  tab: HrApplicationTab;
  sort: HrApplicationSort;
}

/** GET /api/hr/application-filters */
export interface IHrApplicationFilters {
  positions: { code: string; title: string; status: PositionStatus }[];
  categories: { code: string; name: string; isActive: boolean }[];
  levels: { code: string; name: string; isActive: boolean }[];
}

/** One element of evaluations.criteria_scores, as WF-1 stores it */
export interface ICriterionScore {
  criterion_id: string;
  name: string;
  type: CriterionType;
  weight: number;
  is_required: boolean;
  score: number;
  reasoning: string;
  evidence: string;
}

export interface IHrEvaluation {
  overallScore: number;
  recommendation: Recommendation;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  criteriaScores: ICriterionScore[];
  estimatedYearsExperience: number | null;
  estimatedLevel: { code: string; name: string } | null;
  model: string;
  promptVersion: string;
  /** ISO date of the last evaluation */
  evaluatedAt: string;
}

export interface IHrStatusChange {
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: string;
  /** Name of the HR who made the change; null = the system (backend on submit, n8n) */
  changedBy: string | null;
}

/** GET /api/hr/applications/:id */
export interface IHrApplicationDetail {
  id: string;
  fullName: string;
  email: string;
  status: ApplicationStatus;
  createdAt: string;
  cvFileName: string;
  position: {
    code: string;
    title: string;
    category: string;
    level: { code: string; name: string };
    minYearsExperience: number;
    status: PositionStatus;
  };
  evaluation: IHrEvaluation | null;
  history: IHrStatusChange[];
  otherApplications: { id: string; positionTitle: string; status: ApplicationStatus; createdAt: string; overallScore: number | null }[];
  canDecide: boolean;
  canReEvaluate: boolean;
  /** Language the candidate applied in; the result email is written in it */
  locale: ApplicationLocale;
  /** ISO date the result email was sent; null = not sent (yet) */
  resultEmailSentAt: string | null;
  canResendEmail: boolean;
}

/** Response of POST .../decision and POST .../resend-email: the detail + whether the email went out (result-email AC-4, AC-5) */
export interface IHrDecisionResponse extends IHrApplicationDetail {
  emailSent: boolean;
}

/** GET /api/hr/applications/:id/email-preview?decision= (result-email AC-3) */
export interface IHrEmailPreview {
  locale: ApplicationLocale;
  /** The candidate's address, even when MAIL_REDIRECT_TO diverts the real mail */
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Body of POST /api/hr/applications/:id/decision */
export interface IHrDecisionRequest {
  decision: HrDecision;
  note?: string;
}
