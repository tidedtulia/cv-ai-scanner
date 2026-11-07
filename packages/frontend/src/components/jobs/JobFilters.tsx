'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { IJobCategory, IJobLevel } from '@org/shared';
import { useI18n } from '../../i18n/I18nProvider';

export interface JobFilterValues {
  category?: string;
  level?: string;
}

interface JobFiltersProps {
  categories: IJobCategory[];
  levels: IJobLevel[];
  selected: JobFilterValues;
}

/** URL query → matching option code (the API compares codes case-insensitively, the <select> does not). */
const matchCode = (options: { code: string }[], code?: string) =>
  options.find((option) => option.code.toLowerCase() === code?.toLowerCase())?.code ?? '';

/** Filters live in the URL (/jobs?category=…&level=…) so links can be shared and Back keeps them. */
export function JobFilters({ categories, levels, selected }: JobFiltersProps) {
  const { dict } = useI18n();
  const router = useRouter();
  const current = { category: matchCode(categories, selected.category), level: matchCode(levels, selected.level) };

  const update = (key: keyof JobFilterValues, value: string) => {
    const next = { ...current, [key]: value };
    const params = new URLSearchParams();
    if (next.category) params.set('category', next.category);
    if (next.level) params.set('level', next.level);
    const query = params.toString();
    router.push(query ? `/jobs?${query}` : '/jobs');
  };

  const selectClass =
    'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {dict.jobs.category}
        <select value={current.category} onChange={(e) => update('category', e.target.value)} className={selectClass}>
          <option value="">{dict.jobs.allCategories}</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {dict.jobs.level}
        <select value={current.level} onChange={(e) => update('level', e.target.value)} className={selectClass}>
          <option value="">{dict.jobs.allLevels}</option>
          {levels.map((level) => (
            <option key={level.code} value={level.code}>
              {level.name}
            </option>
          ))}
        </select>
      </label>
      {(selected.category || selected.level) && (
        <Link href="/jobs" className="py-2 text-sm font-medium text-blue-600 hover:underline">
          {dict.jobs.clearFilters}
        </Link>
      )}
    </div>
  );
}
