import type { PositionStatus } from '@org/shared';
import type { Dictionary } from '../../i18n/dictionaries';

const STYLE: Record<PositionStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  OPEN: 'bg-green-100 text-green-800',
  CLOSED: 'bg-slate-200 text-slate-700',
};

export function PositionStatusBadge({ status, dict }: { status: PositionStatus; dict: Dictionary }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STYLE[status]}`}>{dict.hrPositions.status[status]}</span>;
}
