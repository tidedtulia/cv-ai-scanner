import type { ApplicationStatus, Recommendation } from '@org/shared';
import type { Dictionary } from '../../i18n/dictionaries';

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  SUBMITTED: 'bg-gray-100 text-gray-700',
  EVALUATING: 'bg-blue-100 text-blue-800',
  EVALUATED: 'bg-indigo-100 text-indigo-800',
  EVALUATION_FAILED: 'bg-red-100 text-red-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-slate-200 text-slate-700',
};

const RECOMMENDATION_STYLE: Record<Recommendation, string> = {
  RECOMMENDED: 'bg-green-100 text-green-800',
  CONSIDER: 'bg-amber-100 text-amber-800',
  NOT_RECOMMENDED: 'bg-red-100 text-red-800',
};

const badge = 'inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap';

export function StatusBadge({ status, dict }: { status: ApplicationStatus; dict: Dictionary }) {
  return <span className={`${badge} ${STATUS_STYLE[status]}`}>{dict.hrApplications.status[status]}</span>;
}

export function RecommendationBadge({ value, dict }: { value: Recommendation; dict: Dictionary }) {
  return <span className={`${badge} ${RECOMMENDATION_STYLE[value]}`}>{dict.hrApplications.recommendation[value]}</span>;
}
