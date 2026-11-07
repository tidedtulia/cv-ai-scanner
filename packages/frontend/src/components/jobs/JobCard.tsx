import Link from 'next/link';
import type { IPublicPositionSummary } from '@org/shared';
import type { Dictionary } from '../../i18n/dictionaries';
import { format } from '../../i18n/format';

export function experienceLabel(minYears: number, dict: Dictionary['jobs']): string {
  return minYears > 0 ? format(dict.experience, { years: minYears }) : dict.noExperience;
}

/** One job of /jobs — content as HR wrote it, labels in the visitor's language. */
export function JobCard({ position, dict }: { position: IPublicPositionSummary; dict: Dictionary['jobs'] }) {
  const titleId = `job-${position.code}`;

  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h2 id={titleId} className="text-lg font-semibold text-gray-900">
        {position.title}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {position.category.name} · {position.level.name} · {experienceLabel(position.minYearsExperience, dict)}
      </p>
      <ul aria-label={dict.criteria} className="mt-4 flex flex-wrap gap-2">
        {position.criteria.map((criterion, index) => (
          <li key={`${criterion.name}-${index}`} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {criterion.name}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-1 items-end">
        <Link
          href={`/submit-cv?position=${encodeURIComponent(position.code)}`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {dict.apply}
        </Link>
      </div>
    </article>
  );
}
